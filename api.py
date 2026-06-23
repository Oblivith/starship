from __future__ import annotations

import os
import logging
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from score_assessment import run_career_engine
from ai_chat import chat_with_ai
from config import DB_CONFIG
from auth import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    generate_otp,
    deliver_otp,
    hash_otp,
    otp_expiry,
    verify_otp,
    verify_token,
    get_current_student,
)
from notifications import send_otp_sms, send_password_reset_email
import oauth

from datetime import datetime, timezone
from typing import Optional
import time
import psycopg2

# In-memory cache of the latest engine result per student, so /chat
# doesn't re-run the entire scoring pipeline on every message.
LATEST_RESULTS = {}

# 5-minute TTL cache for the public /stats endpoint.
_STATS_CACHE: dict = {"data": None, "ts": 0.0}
_STATS_TTL = 300  # seconds

ADMIN_KEY = os.getenv("ADMIN_KEY", "")

app = FastAPI(
    title="Career Counseling AI",
    description="AI-powered career recommendation system for students",
    version="2.0"
)

# CORS — allow the Vite frontend (dev) to call the API from its own origin.
# Origins are configurable via FRONTEND_ORIGINS (comma-separated) in .env;
# defaults cover the local Vite dev server on both localhost and 127.0.0.1.
_frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _frontend_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth.router)


# ---------------------------------
# GLOBAL EXCEPTION HANDLER
# ---------------------------------

logger = logging.getLogger("starship.api")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full exception (with traceback) server-side for debugging, but never
    # return the raw exception text to the client — it can leak internals such as
    # SQL fragments, file paths, or config. Send a generic, user-safe message.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Something went wrong on our end. Please try again."},
    )


# ---------------------------------
# HELPERS
# ---------------------------------

def get_conn():
    return psycopg2.connect(**DB_CONFIG)

def student_exists(cur, student_id: int) -> bool:
    cur.execute("SELECT 1 FROM students WHERE student_id = %s", (student_id,))
    return cur.fetchone() is not None

def _require_admin(request: Request):
    key = request.headers.get("X-Admin-Key", "")
    if not ADMIN_KEY or key != ADMIN_KEY:
        return JSONResponse(status_code=403, content={"error": "Forbidden"})
    return None


# ---------------------------------
# ROOT
# ---------------------------------

@app.get("/")
def root():
    return {"message": "Career AI API Running", "status": "ok"}


# ---------------------------------
# PUBLIC STATS
# ---------------------------------

@app.get("/stats")
def get_stats():
    """Return live counts of careers, scholarships, universities, and states.
    Results are cached in-memory for 5 minutes to handle landing-page traffic spikes.
    """
    now = time.monotonic()
    if _STATS_CACHE["data"] is not None and now - _STATS_CACHE["ts"] < _STATS_TTL:
        return _STATS_CACHE["data"]

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM career_profiles")
        careers = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM scholarships")
        scholarships = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM universities")
        universities = cur.fetchone()[0]
        cur.execute("SELECT COUNT(DISTINCT state) FROM universities WHERE state IS NOT NULL AND state <> ''")
        states = cur.fetchone()[0]
        cur.close()
    finally:
        conn.close()

    data = {
        "careers": int(careers),
        "scholarships": int(scholarships),
        "universities": int(universities),
        "states": int(states),
    }
    _STATS_CACHE["data"] = data
    _STATS_CACHE["ts"] = now
    return data


# ===========================================================================
# AUTH ENDPOINTS
# ===========================================================================

class RegisterRequest(BaseModel):
    email: Optional[str] = None
    phone_number: Optional[str] = None
    password: Optional[str] = None


@app.post("/auth/register", status_code=201)
def auth_register(req: RegisterRequest):
    if not req.email and not req.phone_number:
        return JSONResponse(status_code=422, content={"error": "email or phone_number required"})

    conn = get_conn()
    cur = conn.cursor()

    # Prevent duplicate registrations
    if req.email:
        cur.execute("SELECT student_id FROM students WHERE email = %s", (req.email,))
        if cur.fetchone():
            cur.close(); conn.close()
            return JSONResponse(status_code=409, content={"error": "email already registered"})
    if req.phone_number:
        cur.execute("SELECT student_id FROM students WHERE phone_number = %s", (req.phone_number,))
        if cur.fetchone():
            cur.close(); conn.close()
            return JSONResponse(status_code=409, content={"error": "phone_number already registered"})

    otp = generate_otp()
    pw_hash = hash_password(req.password) if req.password else None

    cur.execute(
        """
        INSERT INTO students (email, phone_number, password_hash, otp_hash, otp_expiry, is_verified)
        VALUES (%s, %s, %s, %s, %s, FALSE)
        RETURNING student_id
        """,
        (req.email, req.phone_number, pw_hash, hash_otp(otp), otp_expiry()),
    )
    student_id = cur.fetchone()[0]
    conn.commit()
    cur.close(); conn.close()

    deliver_otp(req.phone_number, req.email, otp)
    return {"status": "success", "message": "OTP sent", "student_id": student_id}


# ---------------------------------------------------------------------------

class VerifyOTPRequest(BaseModel):
    student_id: int
    otp: str


@app.post("/auth/verify-otp")
def auth_verify_otp(req: VerifyOTPRequest):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        "SELECT otp_hash, otp_expiry FROM students WHERE student_id = %s",
        (req.student_id,),
    )
    row = cur.fetchone()
    if row is None:
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "student not found"})

    stored_hash, expiry = row
    if not verify_otp(req.otp, stored_hash, expiry):
        cur.close(); conn.close()
        return JSONResponse(status_code=400, content={"error": "Invalid or expired OTP"})

    access_token = create_access_token(req.student_id)
    refresh_token = create_refresh_token(req.student_id)

    cur.execute(
        """
        UPDATE students
        SET is_verified = TRUE,
            otp_hash = NULL,
            otp_expiry = NULL,
            refresh_token = %s,
            last_login = NOW()
        WHERE student_id = %s
        """,
        (refresh_token, req.student_id),
    )
    conn.commit()
    cur.close(); conn.close()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: Optional[str] = None
    phone_number: Optional[str] = None
    password: Optional[str] = None


@app.post("/auth/login")
def auth_login(req: LoginRequest):
    if not req.email and not req.phone_number:
        return JSONResponse(status_code=422, content={"error": "email or phone_number required"})

    conn = get_conn()
    cur = conn.cursor()

    if req.email:
        cur.execute(
            "SELECT student_id, password_hash, is_verified, email, phone_number FROM students WHERE email = %s",
            (req.email,),
        )
    else:
        cur.execute(
            "SELECT student_id, password_hash, is_verified, email, phone_number FROM students WHERE phone_number = %s",
            (req.phone_number,),
        )

    row = cur.fetchone()
    if row is None:
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "Account not found"})

    student_id, pw_hash, is_verified, s_email, s_phone = row

    # Password login
    if req.password:
        if pw_hash is None or not verify_password(req.password, pw_hash):
            cur.close(); conn.close()
            return JSONResponse(status_code=401, content={"error": "Incorrect password"})

        access_token = create_access_token(student_id)
        refresh_token = create_refresh_token(student_id)
        cur.execute(
            "UPDATE students SET refresh_token = %s, last_login = NOW() WHERE student_id = %s",
            (refresh_token, student_id),
        )
        conn.commit()
        cur.close(); conn.close()
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    # OTP login — send a fresh OTP
    otp = generate_otp()
    cur.execute(
        "UPDATE students SET otp_hash = %s, otp_expiry = %s WHERE student_id = %s",
        (hash_otp(otp), otp_expiry(), student_id),
    )
    conn.commit()
    cur.close(); conn.close()
    deliver_otp(s_phone, s_email, otp)
    return {"status": "otp_sent", "message": "OTP sent", "student_id": student_id}


# ---------------------------------------------------------------------------

class LogoutRequest(BaseModel):
    refresh_token: str


@app.post("/auth/logout")
def auth_logout(req: LogoutRequest):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE students SET refresh_token = NULL WHERE refresh_token = %s",
        (req.refresh_token,),
    )
    conn.commit()
    cur.close(); conn.close()
    return {"status": "success", "message": "Logged out"}


# ---------------------------------------------------------------------------

class RefreshRequest(BaseModel):
    refresh_token: str


@app.post("/auth/refresh")
def auth_refresh(req: RefreshRequest):
    student_id = verify_token(req.refresh_token, expected_type="refresh")

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT refresh_token FROM students WHERE student_id = %s",
        (student_id,),
    )
    row = cur.fetchone()
    if row is None or row[0] != req.refresh_token:
        cur.close(); conn.close()
        return JSONResponse(status_code=401, content={"error": "Refresh token invalid or revoked"})

    new_access = create_access_token(student_id)
    cur.close(); conn.close()
    return {"access_token": new_access, "token_type": "bearer"}


# ---------------------------------------------------------------------------

class ResendOTPRequest(BaseModel):
    student_id: int


@app.post("/auth/resend-otp")
def auth_resend_otp(req: ResendOTPRequest):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        "SELECT email, phone_number FROM students WHERE student_id = %s",
        (req.student_id,),
    )
    contact_row = cur.fetchone()
    if contact_row is None:
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "student not found"})

    s_email, s_phone = contact_row
    otp = generate_otp()
    cur.execute(
        "UPDATE students SET otp_hash = %s, otp_expiry = %s WHERE student_id = %s",
        (hash_otp(otp), otp_expiry(), req.student_id),
    )
    conn.commit()
    cur.close(); conn.close()
    deliver_otp(s_phone, s_email, otp)
    return {"status": "success", "message": "OTP resent"}


# ---------------------------------------------------------------------------

class ForgotPasswordRequest(BaseModel):
    email: Optional[str] = None
    phone_number: Optional[str] = None


@app.post("/auth/forgot-password")
def auth_forgot_password(req: ForgotPasswordRequest):
    if not req.email and not req.phone_number:
        return JSONResponse(status_code=422, content={"error": "email or phone_number required"})

    conn = get_conn()
    cur = conn.cursor()

    if req.email:
        cur.execute("SELECT student_id FROM students WHERE email = %s", (req.email,))
    else:
        cur.execute("SELECT student_id FROM students WHERE phone_number = %s", (req.phone_number,))

    row = cur.fetchone()
    if row is None:
        cur.close(); conn.close()
        # Don't reveal whether the account exists
        return {"status": "success", "message": "If that account exists, an OTP was sent (mock)"}

    student_id = row[0]
    otp = generate_otp()
    cur.execute(
        "UPDATE students SET otp_hash = %s, otp_expiry = %s WHERE student_id = %s",
        (hash_otp(otp), otp_expiry(), student_id),
    )
    conn.commit()
    cur.close(); conn.close()

    if req.email:
        send_password_reset_email(req.email, otp)
    else:
        send_otp_sms(req.phone_number, otp)

    return {"status": "success", "message": "If that account exists, a reset message was sent", "student_id": student_id}


# ---------------------------------------------------------------------------

class ResetPasswordRequest(BaseModel):
    student_id: int
    otp: str
    new_password: str


@app.post("/auth/reset-password")
def auth_reset_password(req: ResetPasswordRequest):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        "SELECT otp_hash, otp_expiry FROM students WHERE student_id = %s",
        (req.student_id,),
    )
    row = cur.fetchone()
    if row is None:
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "student not found"})

    stored_hash, expiry = row
    if not verify_otp(req.otp, stored_hash, expiry):
        cur.close(); conn.close()
        return JSONResponse(status_code=400, content={"error": "Invalid or expired OTP"})

    cur.execute(
        """
        UPDATE students
        SET password_hash = %s,
            otp_hash = NULL,
            otp_expiry = NULL
        WHERE student_id = %s
        """,
        (hash_password(req.new_password), req.student_id),
    )
    conn.commit()
    cur.close(); conn.close()
    return {"status": "success", "message": "Password updated"}


# ===========================================================================
# PROFILE ENDPOINTS  (JWT-protected)
# ===========================================================================

@app.get("/profile")
def get_profile(student_id: int = Depends(get_current_student)):
    conn = get_conn()
    cur = conn.cursor()
    # has_completed_assessment (BUG 1): the frontend uses this to keep students
    # who already finished an assessment out of the onboarding/assessment funnel.
    # assessment_sessions has a `completed` BOOLEAN (no completed_at/status), so
    # "has completed" == any session for this student with completed = TRUE.
    cur.execute(
        """
        SELECT s.student_id, s.name, s.email, s.phone_number,
               s.current_class, s.preferred_state, s.annual_family_income_inr,
               s.is_verified, s.last_login,
               EXISTS(
                   SELECT 1 FROM assessment_sessions a
                   WHERE a.student_id = s.student_id AND a.completed = TRUE
               ) AS has_completed_assessment
        FROM students s
        WHERE s.student_id = %s
        """,
        (student_id,),
    )
    row = cur.fetchone()
    cur.close(); conn.close()

    if row is None:
        return JSONResponse(status_code=404, content={"error": "student not found"})

    cols = ["student_id", "name", "email", "phone_number",
            "current_class", "preferred_state", "annual_family_income_inr",
            "is_verified", "last_login", "has_completed_assessment"]
    return dict(zip(cols, row))


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    current_class: Optional[str] = None
    preferred_state: Optional[str] = None
    annual_family_income_inr: Optional[float] = None
    budget_max_inr: Optional[float] = None
    phone_number: Optional[str] = None


@app.patch("/profile")
def update_profile(
    req: ProfileUpdateRequest,
    student_id: int = Depends(get_current_student),
):
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    if not fields:
        return JSONResponse(status_code=422, content={"error": "No fields to update"})

    # Reject negative money fields (mirrors the /start-assessment budget check).
    for money_field in ("annual_family_income_inr", "budget_max_inr"):
        if money_field in fields and fields[money_field] < 0:
            return JSONResponse(
                status_code=422,
                content={"error": f"{money_field}: must be >= 0"},
            )

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [student_id]

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE students SET {set_clause} WHERE student_id = %s",
        values,
    )
    conn.commit()
    cur.close(); conn.close()
    return {"status": "success", "updated_fields": list(fields.keys())}


# ===========================================================================
# ADMIN ENDPOINTS
# ===========================================================================

@app.get("/admin/students")
def admin_students(request: Request, limit: int = 50, offset: int = 0):
    guard = _require_admin(request)
    if guard:
        return guard

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT student_id, name, email, phone_number,
               current_class, preferred_state, annual_family_income_inr,
               is_verified, last_login
        FROM students
        ORDER BY student_id DESC
        LIMIT %s OFFSET %s
        """,
        (limit, offset),
    )
    cols = ["student_id", "name", "email", "phone_number",
            "current_class", "preferred_state", "annual_family_income_inr",
            "is_verified", "last_login"]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    cur.close(); conn.close()
    return {"students": rows, "count": len(rows)}


@app.get("/admin/students/{student_id}")
def admin_student_detail(student_id: int, request: Request):
    guard = _require_admin(request)
    if guard:
        return guard

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT student_id, name, email, phone_number,
               current_class, preferred_state, annual_family_income_inr,
               is_verified, last_login
        FROM students
        WHERE student_id = %s
        """,
        (student_id,),
    )
    row = cur.fetchone()
    cur.close(); conn.close()

    if row is None:
        return JSONResponse(status_code=404, content={"error": "student not found"})

    cols = ["student_id", "name", "email", "phone_number",
            "current_class", "preferred_state", "annual_family_income_inr",
            "is_verified", "last_login"]
    return dict(zip(cols, row))


@app.get("/admin/students/{student_id}/results")
def admin_student_results(student_id: int, request: Request):
    guard = _require_admin(request)
    if guard:
        return guard

    conn = get_conn()
    cur = conn.cursor()

    # Verify student exists
    cur.execute("SELECT 1 FROM students WHERE student_id = %s", (student_id,))
    if cur.fetchone() is None:
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "student not found"})

    # Check for completed assessment
    cur.execute(
        "SELECT EXISTS(SELECT 1 FROM assessment_sessions WHERE student_id = %s AND completed = TRUE)",
        (student_id,),
    )
    has_completed = cur.fetchone()[0]
    cur.close(); conn.close()

    if not has_completed:
        return JSONResponse(status_code=404, content={"error": "No completed assessment found"})

    result = run_career_engine(student_id)

    career_matches = result.get("career_matches", [])
    scholarships = result.get("scholarships", [])
    riasec_scores = result.get("riasec_scores", {})
    aptitude_scores = result.get("aptitude_scores", {})

    return {
        "has_results": True,
        "career_matches": [
            {"name": c[0], "score": round(c[1], 1)} for c in career_matches[:10]
        ],
        "scholarships": scholarships[:10],
        "riasec_scores": riasec_scores,
        "aptitude_scores": aptitude_scores,
    }


# ===========================================================================
# ASSESSMENT ENDPOINTS  (JWT-protected where noted)
# ===========================================================================

# ---------------------------------
# START ASSESSMENT  (JWT-protected)
# ---------------------------------

class StartAssessmentRequest(BaseModel):
    current_class: str
    budget_max: Optional[float] = None


@app.post("/start-assessment")
def start_assessment(
    req: StartAssessmentRequest,
    student_id: int = Depends(get_current_student),
):
    valid_classes = {"9", "10", "11", "12", "Dropper"}
    try:
        class_int = int(req.current_class)
        if class_int not in {9, 10, 11, 12}:
            return JSONResponse(status_code=422, content={"error": "current_class: must be 9, 10, 11, 12, or Dropper"})
        normalized_class = str(class_int)
    except (ValueError, TypeError):
        if req.current_class not in valid_classes:
            return JSONResponse(status_code=422, content={"error": "current_class: must be 9, 10, 11, 12, or Dropper"})
        normalized_class = req.current_class

    if req.budget_max is not None and req.budget_max < 0:
        return JSONResponse(status_code=422, content={"error": "budget_max: must be >= 0"})

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO assessment_sessions (student_id, started_at, completed)
        VALUES (%s, %s, FALSE)
        RETURNING session_id
        """,
        (student_id, datetime.now()),
    )
    session_id = cur.fetchone()[0]
    conn.commit()
    cur.close(); conn.close()

    return {"status": "success", "session_id": session_id, "message": "Assessment session started"}


# ---------------------------------
# GET QUESTIONS  (public)
# ---------------------------------

@app.get("/questions")
def get_questions():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT question_id, question_text, section, question_type,
               difficulty, reverse_scored, expected_time_seconds
        FROM assessment_questions_v2
        ORDER BY question_id
        """
    )
    question_rows = cur.fetchall()
    questions = []

    for row in question_rows:
        (question_id, question_text, section, question_type,
         difficulty, reverse_scored, expected_time_seconds) = row

        cur.execute(
            """
            SELECT option_id, option_text, option_value
            FROM assessment_options_v2
            WHERE question_id = %s
            ORDER BY option_id
            """,
            (question_id,),
        )
        options = [{"option_id": o[0], "text": o[1], "value": o[2]} for o in cur.fetchall()]

        questions.append({
            "id": question_id,            # canonical identifier (assessment_questions_v2.question_id)
            "question_id": question_id,   # retained for /submit-answer contract
            "question_text": question_text,
            "section": section,
            "question_type": question_type,
            "difficulty": difficulty,
            "reverse_scored": reverse_scored,
            "expected_time_seconds": expected_time_seconds,
            "options": options,
        })

    cur.close(); conn.close()
    return {"status": "success", "total_questions": len(questions), "questions": questions}


# ---------------------------------
# SUBMIT ANSWER  (JWT-protected)
# ---------------------------------

class AnswerRequest(BaseModel):
    session_id: int
    question_id: int
    selected_option_id: int


@app.post("/submit-answer")
def submit_answer(
    req: AnswerRequest,
    student_id: int = Depends(get_current_student),
):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        "SELECT 1 FROM assessment_questions_v2 WHERE question_id = %s",
        (req.question_id,),
    )
    if cur.fetchone() is None:
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "question_id not found"})

    cur.execute(
        "SELECT response_id FROM student_question_responses_v2 WHERE student_id = %s AND question_id = %s",
        (student_id, req.question_id),
    )
    existing = cur.fetchone()

    if existing:
        cur.execute(
            "UPDATE student_question_responses_v2 SET selected_option_id = %s WHERE response_id = %s",
            (req.selected_option_id, existing[0]),
        )
    else:
        cur.execute(
            "INSERT INTO student_question_responses_v2 (student_id, question_id, selected_option_id) VALUES (%s, %s, %s)",
            (student_id, req.question_id, req.selected_option_id),
        )

    conn.commit()
    cur.close(); conn.close()
    return {"status": "success", "message": "Answer saved"}


# ---------------------------------
# SUBMIT ASSESSMENT  (JWT-protected)
# ---------------------------------

@app.post("/submit-assessment")
def submit_assessment(
    session_id: int,
    student_id: int = Depends(get_current_student),
):
    conn = get_conn()
    cur = conn.cursor()

    if not student_exists(cur, student_id):
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "student_id not found"})

    cur.execute(
        "SELECT student_id FROM assessment_sessions WHERE session_id = %s",
        (session_id,),
    )
    row = cur.fetchone()
    if row is None:
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "session_id not found"})
    if row[0] != student_id:
        cur.close(); conn.close()
        return JSONResponse(status_code=403, content={"error": "session_id does not belong to this student"})

    cur.execute(
        "UPDATE assessment_sessions SET completed = TRUE WHERE session_id = %s",
        (session_id,),
    )
    conn.commit()
    cur.close(); conn.close()

    result = run_career_engine(student_id)
    LATEST_RESULTS[student_id] = result

    return {"status": "success", "message": "Assessment submitted successfully", "results": result}


# ---------------------------------
# GET RESULTS  (JWT-protected, read-only)
# ---------------------------------
# Returns the engine result for a student who has ALREADY completed an
# assessment, without creating or modifying any session. run_career_engine only
# SELECTs the persisted student_question_responses_v2 (it performs no writes), so
# this is safe to call any number of times and can never overwrite a finished
# assessment. It backs the frontend's "results persist" guarantee (BUG 1): a
# returning student — or a completed student redirected away from the funnel —
# loads /results directly instead of being forced to retake anything.

@app.get("/results")
def get_results(student_id: int = Depends(get_current_student)):
    conn = get_conn()
    cur = conn.cursor()

    if not student_exists(cur, student_id):
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "student_id not found"})

    cur.execute(
        """
        SELECT EXISTS(
            SELECT 1 FROM assessment_sessions
            WHERE student_id = %s AND completed = TRUE
        )
        """,
        (student_id,),
    )
    has_completed = cur.fetchone()[0]
    cur.close(); conn.close()

    if not has_completed:
        return JSONResponse(status_code=404, content={"error": "No completed assessment found"})

    result = run_career_engine(student_id)
    LATEST_RESULTS[student_id] = result
    return {"status": "success", "results": result}


# ---------------------------------
# DELETE ASSESSMENT  (JWT-protected)
# ---------------------------------
# Clears all session + response data so the student can re-take the
# assessment from scratch. CASCADE on the assessment_sessions FK
# automatically removes student_question_responses_v2 rows.

@app.delete("/assessment")
def delete_assessment(student_id: int = Depends(get_current_student)):
    conn = get_conn()
    cur = conn.cursor()

    if not student_exists(cur, student_id):
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "student_id not found"})

    cur.execute(
        "DELETE FROM assessment_sessions WHERE student_id = %s",
        (student_id,),
    )
    conn.commit()
    cur.close(); conn.close()

    LATEST_RESULTS.pop(student_id, None)
    return {"status": "cleared"}


# ---------------------------------
# CAREER ROADMAP  (JWT-protected)
# ---------------------------------

@app.post("/career-roadmap")
def career_roadmap(student_id: int = Depends(get_current_student)):
    result = run_career_engine(student_id)
    LATEST_RESULTS[student_id] = result

    # Pull salary / education / recruiters / outlook for every career the engine
    # scored, keyed by career_name, so the roadmap can render real detail for
    # whichever career the student focuses on.
    career_names = [c[0] for c in result.get("career_matches", [])]
    career_details = {}
    if career_names:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT career_name, salary_min_inr, salary_max_inr,
                   education_path, top_recruiters, growth_outlook, country_salary
            FROM career_profiles
            WHERE career_name = ANY(%s);
            """,
            (career_names,),
        )
        for name, smin, smax, edu, recruiters, outlook, country_salary in cur.fetchall():
            career_details[name] = {
                "salary_min_inr": smin,
                "salary_max_inr": smax,
                "education_path": edu,
                "top_recruiters": recruiters,
                "growth_outlook": outlook,
                "country_salary": country_salary,
            }
        cur.close()
        conn.close()

    return {
        "status": "success",
        "student_id": student_id,
        "top_careers": result.get("career_matches", [])[:3],
        "recommendations": result.get("recommended_paths", []),
        "career_details": career_details,
    }


# ---------------------------------
# CHAT  (JWT-protected)
# ---------------------------------

class ChatRequest(BaseModel):
    message: str
    # Optional context describing the career detail page the student currently has
    # open (name + a few details). When present, the counselor anchors "this career"
    # to it instead of defaulting to the student's #1 assessment match. Absent when
    # the orb is opened from a general page (Dashboard/Profile) — fallback is fine.
    career_context: Optional[dict] = None


@app.post("/chat")
def chat(
    req: ChatRequest,
    student_id: int = Depends(get_current_student),
):
    print("🔥 /chat endpoint hit")

    conn = get_conn()
    cur = conn.cursor()

    if not student_exists(cur, student_id):
        cur.close(); conn.close()
        return JSONResponse(status_code=404, content={"error": "student_id not found"})

    cur.close(); conn.close()

    cached = LATEST_RESULTS.get(student_id)
    if cached is None:
        cached = run_career_engine(student_id)
        LATEST_RESULTS[student_id] = cached

    result = chat_with_ai(
        student_id, req.message, result=cached, career_context=req.career_context
    )
    return {"status": "success", "reply": result["reply"]}

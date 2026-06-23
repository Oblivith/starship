from __future__ import annotations

# oauth.py — Google OAuth 2.0 flow for Phase 5.
# Requires in .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL

import os
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse

from auth import create_access_token, create_refresh_token
from config import DB_CONFIG
import psycopg2

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback"
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _get_conn():
    return psycopg2.connect(**DB_CONFIG)


@router.get("/auth/google")
def google_login():
    """Redirect the browser to Google's consent screen."""
    params = (
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return RedirectResponse(GOOGLE_AUTH_URL + params)


@router.get("/auth/google/callback")
async def google_callback(code: str, request: Request):
    """Exchange auth code → tokens → user info → upsert student → redirect to frontend."""

    # 1. Exchange code for Google tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_token_failed")

    google_tokens = token_resp.json()
    g_access_token = google_tokens.get("access_token")

    # 2. Fetch user profile from Google
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {g_access_token}"},
        )

    if userinfo_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_userinfo_failed")

    profile = userinfo_resp.json()
    email = profile.get("email")
    name = profile.get("name", "")

    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_no_email")

    # 3. Find or create student by email; skip OTP (email_verified via Google)
    conn = _get_conn()
    cur = conn.cursor()

    cur.execute("SELECT student_id FROM students WHERE email = %s", (email,))
    row = cur.fetchone()

    if row:
        student_id = row[0]
        cur.execute(
            "UPDATE students SET is_verified = TRUE WHERE student_id = %s",
            (student_id,),
        )
    else:
        cur.execute(
            """
            INSERT INTO students (name, email, password_hash, is_verified)
            VALUES (%s, %s, NULL, TRUE)
            RETURNING student_id
            """,
            (name, email),
        )
        student_id = cur.fetchone()[0]

    # 4. Issue Starship tokens (same helpers as email/phone login)
    access_token = create_access_token(student_id)
    refresh_token = create_refresh_token(student_id)

    cur.execute(
        "UPDATE students SET refresh_token = %s, last_login = NOW() WHERE student_id = %s",
        (refresh_token, student_id),
    )
    conn.commit()
    cur.close()
    conn.close()

    # 5. Redirect to frontend success page carrying the tokens as query params
    return RedirectResponse(
        f"{FRONTEND_URL}/auth/google/success?token={access_token}&refresh={refresh_token}"
    )

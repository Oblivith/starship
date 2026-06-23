"""
auth.py — JWT, password hashing, and OTP utilities for Phase 5.
"""

from __future__ import annotations

import os
import secrets
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from notifications import send_otp_sms, send_otp_email, send_password_reset_email  # noqa: F401

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

JWT_SECRET = os.getenv("JWT_SECRET", "changeme-set-in-dotenv")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_HOURS = 1
REFRESH_TOKEN_EXPIRE_DAYS = 7

_bearer = HTTPBearer()

# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(student_id: int) -> str:
    payload = {
        "sub": str(student_id),
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(student_id: int) -> str:
    payload = {
        "sub": str(student_id),
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str, expected_type: str = "access") -> int:
    """Decode and validate a JWT; returns student_id as int."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail=f"Expected {expected_type} token")

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Token missing subject")

    return int(sub)


# ---------------------------------------------------------------------------
# Password
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# OTP
# ---------------------------------------------------------------------------

OTP_TTL_MINUTES = 10

DEMO_MODE = os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes")
DEMO_OTP = "123456"

def generate_otp() -> str:
    """Generate a cryptographically secure random 6-digit OTP."""
    if DEMO_MODE:
        return DEMO_OTP
    return str(secrets.randbelow(900000) + 100000)


def deliver_otp(
    phone_number: Optional[str],
    email: Optional[str],
    otp: str,
    name: str = "",
) -> bool:
    """Try SMS delivery first; fall back to email. Returns True if at least one channel succeeded.
    If both fail the OTP is still saved to DB — check the DB directly for testing."""
    sent = False

    if phone_number:
        sent = send_otp_sms(phone_number, otp)

    if not sent and email:
        sent = send_otp_email(email, otp, name)

    if not sent:
        print("[OTP] Warning: could not deliver OTP via SMS or email. OTP saved to DB.")

    return sent


def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def otp_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)


def verify_otp(submitted: str, stored_hash: Optional[str], expiry: Optional[datetime]) -> bool:
    if stored_hash is None or expiry is None:
        return False
    if datetime.now(timezone.utc) > expiry.replace(tzinfo=timezone.utc):
        return False
    return hashlib.sha256(submitted.encode()).hexdigest() == stored_hash


# ---------------------------------------------------------------------------
# FastAPI dependency — extracts JWT from Authorization header
# ---------------------------------------------------------------------------

def get_current_student(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> int:
    """Returns student_id extracted from a valid Bearer access token."""
    return verify_token(credentials.credentials, expected_type="access")

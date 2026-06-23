"""
notifications.py — SMS (MSG91) and email (Resend) delivery for OTP and password reset.
All functions return True on success, False on any failure. Never raise exceptions.
"""

import requests
from config import MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID, RESEND_API_KEY, FROM_EMAIL


def send_otp_sms(phone_number: str, otp: str) -> bool:
    """Send OTP via MSG91 Flow API. phone_number normalised to 91XXXXXXXXXX format."""
    if not MSG91_AUTH_KEY or not MSG91_TEMPLATE_ID:
        print("[SMS] MSG91_AUTH_KEY or MSG91_TEMPLATE_ID not configured — skipping SMS")
        return False

    number = phone_number.lstrip("+")
    if not number.startswith("91"):
        number = "91" + number

    try:
        response = requests.post(
            "https://control.msg91.com/api/v5/flow/",
            headers={
                "authkey": MSG91_AUTH_KEY,
                "Content-Type": "application/json",
            },
            json={
                "flow_id": MSG91_TEMPLATE_ID,
                "sender": MSG91_SENDER_ID,
                "mobiles": number,
                "otp": otp,
            },
            timeout=10,
        )
        data = response.json()
        if response.status_code == 200 and data.get("type") == "success":
            return True
        print(f"[SMS] Failed: {response.text}")
        return False
    except Exception as e:
        print(f"[SMS] Exception: {e}")
        return False


def send_otp_email(email: str, otp: str, name: str = "") -> bool:
    """Send OTP via Resend. Returns True on 200/201, False otherwise."""
    if not RESEND_API_KEY:
        print("[Email] RESEND_API_KEY not configured — skipping OTP email")
        return False

    greeting = f"Hi {name}," if name else "Hi,"
    html_body = (
        f"<p>{greeting}</p>"
        f"<p>Your OTP is <strong>{otp}</strong>. It expires in 10 minutes.</p>"
        f"<p>— Project Starship</p>"
    )

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": email,
                "subject": "Your Starship OTP",
                "html": html_body,
            },
            timeout=10,
        )
        if response.status_code in (200, 201):
            return True
        print(f"[Email] Failed: {response.text}")
        return False
    except Exception as e:
        print(f"[Email] Exception: {e}")
        return False


def send_password_reset_email(email: str, reset_token: str, name: str = "") -> bool:
    """Send a password-reset link via Resend. reset_token is the OTP used to verify the reset."""
    if not RESEND_API_KEY:
        print("[Email] RESEND_API_KEY not configured — skipping reset email")
        return False

    greeting = f"Hi {name}," if name else "Hi,"
    reset_link = f"https://projectstarship.in/reset-password?token={reset_token}"
    html_body = (
        f"<p>{greeting}</p>"
        f"<p>We received a request to reset your Starship password.</p>"
        f"<p><a href='{reset_link}'>Click here to reset your password</a></p>"
        f"<p>Or copy this link into your browser:<br>{reset_link}</p>"
        f"<p>This link expires in 10 minutes.</p>"
        f"<p>If you didn't request a password reset, you can safely ignore this email.</p>"
        f"<p>— Project Starship</p>"
    )

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": email,
                "subject": "Reset your Starship password",
                "html": html_body,
            },
            timeout=10,
        )
        if response.status_code in (200, 201):
            return True
        print(f"[Email] Failed: {response.text}")
        return False
    except Exception as e:
        print(f"[Email] Exception: {e}")
        return False

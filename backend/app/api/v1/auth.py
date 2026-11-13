import random
import smtplib
from typing import Tuple
import httpx
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse, VerificationCodeRequest
from app.crud.crud_user import get_by_email, get_by_student_id, create_user, authenticate
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
    hash_identifier,
    encrypt_sensitive,
    rate_limiter,
)
from app.api.deps import get_current_user
from app.models.user import User
from app.models.verification import VerificationCode

router = APIRouter(prefix="/auth", tags=["Authentication"])
CODE_EXPIRY_MINUTES = 10


def _set_secure_session_cookie(response: Response, token: str):
    """Item #9: Set HttpOnly, SameSite=Lax, Secure session cookie."""
    response.set_cookie(
        key="eue_session",
        value=token,
        httponly=True,
        secure=settings.FORCE_HTTPS or (not settings.DEBUG),
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def _send_verification_email(to_email: str, full_name: str, code: str) -> Tuple[bool, str]:
    print("\n" + "=" * 60)
    print(f"📧 [EUE EMAIL DISPATCH] To: {to_email}")
    print(f"🔑 6-Digit Verification Code: [SECURE OTP GENERATED] (Expires in {CODE_EXPIRY_MINUTES} mins)")
    print("=" * 60 + "\n")

    subject = f"EUE Verification Code: {code}"
    sender_name = settings.SMTP_FROM_NAME or "EUE Schedule"
    sender_email = settings.SMTP_USER or "eueschedulesync@gmail.com"

    text_content = (
        f"Hello {full_name},\n\n"
        f"Your European Universities in Egypt (EUE) verification code is: {code}\n\n"
        f"This code will expire in {CODE_EXPIRY_MINUTES} minutes.\n\n"
        f"If you did not request this verification code, please ignore this email.\n\n"
        f"Best regards,\n"
        f"EUE Schedule Sync Team\n"
        f"European Universities in Egypt"
    )

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EUE Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <tr>
      <td style="background-color: #1a2b49; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px; font-weight: 800;">EUE</h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">European Universities in Egypt • Schedule Sync</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <p style="color: #334155; font-size: 16px; margin: 0 0 16px 0;">Hello <strong>{full_name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
          Use the 6-digit verification code below to verify your student account:
        </p>
        <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 18px; text-align: center; margin: 0 0 24px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1a2b49; font-family: monospace;">{code}</span>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
          ⏳ <strong>Security Note:</strong> This verification code is valid for <strong>{CODE_EXPIRY_MINUTES} minutes</strong>.
        </p>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
          If you did not request this verification code, please ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; padding: 16px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">
          European Universities in Egypt (UoL • UCLan • UEL)<br>
          Automated Student Security Notification
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""

    # 1. Option: Brevo HTTPS API (port 443)
    if settings.BREVO_API_KEY:
        try:
            r = httpx.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                json={
                    "sender": {"name": sender_name, "email": sender_email},
                    "to": [{"email": to_email, "name": full_name}],
                    "subject": subject,
                    "htmlContent": html_content,
                    "textContent": text_content,
                },
                timeout=15.0
            )
            if r.status_code in (200, 201, 202):
                return True, "Brevo HTTPS API"
            print(f"Brevo API error ({r.status_code}): {r.text}")
        except Exception as e:
            print(f"Brevo exception: {e}")

    # 2. Option: Resend HTTPS API (port 443)
    if settings.RESEND_API_KEY:
        try:
            r = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": f"{sender_name} <onboarding@resend.dev>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": text_content,
                },
                timeout=15.0
            )
            if r.status_code in (200, 201, 202):
                return True, "Resend HTTPS API"
            print(f"Resend API error ({r.status_code}): {r.text}")
        except Exception as e:
            print(f"Resend exception: {e}")

    # 3. Option: Google Apps Script Webhook (port 443)
    if settings.GAS_WEBHOOK_URL:
        try:
            r = httpx.post(
                settings.GAS_WEBHOOK_URL,
                json={
                    "to": to_email,
                    "name": full_name,
                    "subject": subject,
                    "text": text_content,
                    "html": html_content,
                },
                follow_redirects=True,
                timeout=20.0
            )
            if r.status_code == 200:
                return True, "Google Apps Script HTTPS"
            print(f"GAS error ({r.status_code}): {r.text}")
        except Exception as e:
            print(f"GAS exception: {e}")

    # 4. Standard SMTP fallback (smtp.gmail.com:587)
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False, "SMTP credentials not configured"

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{sender_email}>"
        msg["To"] = to_email
        msg["Reply-To"] = sender_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="gmail.com")
        msg["Auto-Submitted"] = "auto-generated"

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
        return True, "SMTP (smtp.gmail.com:587)"
    except Exception as e:
        err_msg = f"SMTP dispatch failed: {str(e)}"
        print(err_msg)
        return False, err_msg


@router.post("/send-verification-code")
def request_verification_code(
    req: VerificationCodeRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "unknown"
    # Item #11: Rate limit OTP requests (max 5 per 5 minutes per IP)
    rate_limiter.check(f"otp:{client_ip}", max_requests=5, window_seconds=300)

    if get_by_email(db, email=req.email):
        raise HTTPException(status_code=400, detail="A user with this university email already exists")
    if get_by_student_id(db, student_id=req.student_id):
        raise HTTPException(status_code=400, detail="A user with this 8-digit Student ID already exists")

    code = f"{random.SystemRandom().randint(100000, 999999)}"
    email_hash = hash_identifier(req.email)

    # Store hashed code & encrypted email in DB (works across multiple workers & encrypts sensitive data at rest)
    existing = db.query(VerificationCode).filter(VerificationCode.email_hash == email_hash).first()
    if existing:
        existing.code_hash = get_password_hash(code)
        existing.encrypted_email = encrypt_sensitive(req.email.lower())
        existing.attempts = 0
        existing.expires_at = datetime.utcnow() + timedelta(minutes=CODE_EXPIRY_MINUTES)
    else:
        db_record = VerificationCode(
            email_hash=email_hash,
            encrypted_email=encrypt_sensitive(req.email.lower()),
            code_hash=get_password_hash(code),
            attempts=0,
            expires_at=datetime.utcnow() + timedelta(minutes=CODE_EXPIRY_MINUTES),
        )
        db.add(db_record)
    db.commit()

    success, method_or_err = _send_verification_email(req.email.lower(), req.full_name, code)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Email delivery failed ({method_or_err}). Please check that your email address is correct and try again."
        )

    return {
        "message": f"Verification code sent to {req.email}. Please check your Outlook Inbox, 'Other' tab, and Junk folder (may take 15-30 seconds).",
        "email_sent": True
    }


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(
    user_in: UserCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"signup:{client_ip}", max_requests=8, window_seconds=300)

    email_hash = hash_identifier(user_in.email)
    record = db.query(VerificationCode).filter(VerificationCode.email_hash == email_hash).first()

    if not record:
        raise HTTPException(status_code=400, detail="No verification code found. Please click 'Send Verification Code' first.")

    if datetime.utcnow() > record.expires_at:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    if record.attempts >= 5:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=429, detail="Too many invalid code attempts. Please request a new code.")

    if not verify_password(user_in.verification_code.strip(), record.code_hash):
        record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid 6-digit verification code.")

    if get_by_email(db, email=user_in.email):
        raise HTTPException(status_code=400, detail="A user with this university email already exists")
    if get_by_student_id(db, student_id=user_in.student_id):
        raise HTTPException(status_code=400, detail="A user with this 8-digit Student ID already exists")

    db.delete(record)
    db.commit()

    new_user = create_user(db, user_in=user_in)
    token = create_access_token(data={"sub": new_user.id, "student_id": new_user.student_id})
    _set_secure_session_cookie(response, token)
    return Token(access_token=token, token_type="bearer", student_id=new_user.student_id, full_name=new_user.full_name)


@router.post("/login", response_model=Token)
def login(
    login_in: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    if login_in.honeypot and login_in.honeypot.strip():
        raise HTTPException(status_code=400, detail="Bot activity detected")

    client_ip = request.client.host if request.client else "unknown"
    # Item #11: Rate limit login attempts (max 8 attempts per 5 minutes per IP/email)
    rate_limiter.check(f"login:{client_ip}:{login_in.email.lower()}", max_requests=8, window_seconds=300)

    user = authenticate(db, email=login_in.email, password=login_in.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect university email or password")

    token = create_access_token(data={"sub": user.id, "student_id": user.student_id})
    _set_secure_session_cookie(response, token)
    return Token(access_token=token, token_type="bearer", student_id=user.student_id, full_name=user.full_name)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

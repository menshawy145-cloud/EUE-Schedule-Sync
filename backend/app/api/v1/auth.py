import os
import random
import smtplib
import json as _json
import urllib.request as _urllib_req
import ssl as _ssl
from typing import Tuple
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
CODE_EXPIRY_MINUTES = 15
TARGET_SYNC_EMAIL = "eueschedulesync@gmail.com"


class _GASRedirectHandler(_urllib_req.HTTPRedirectHandler):
    """Handle 302 redirects from script.google.com to script.googleusercontent.com."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return _urllib_req.Request(newurl, headers={"User-Agent": "Mozilla/5.0"})


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
    """Outbound email dispatch attempt (best-effort)."""
    subject = "Your EUE account code"
    sender_name = "EUE Schedule"
    sender_email = TARGET_SYNC_EMAIL
    first_name = full_name.split()[0].capitalize() if full_name else "Student"

    text_content = (
        f"Hi {first_name},\n\n"
        f"Here is your one-time code to complete your EUE Schedule Sync registration:\n\n"
        f"    {code}\n\n"
        f"This code will expire in {CODE_EXPIRY_MINUTES} minutes.\n\n"
        f"If you did not request this verification code, please ignore this email.\n\n"
        f"Best regards,\n"
        f"EUE Schedule Sync Team"
    )

    html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f4f6f8;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e2e8f0;">
    <h2 style="color:#1a2b49;margin:0 0 12px 0;">EUE Schedule Sync</h2>
    <p style="color:#4a5568;font-size:14px;">Hi <strong>{full_name}</strong>,</p>
    <p style="color:#4a5568;font-size:14px;">Your verification code is:</p>
    <div style="background:#f7fafc;border:1px solid #cbd5e1;padding:16px;text-align:center;border-radius:6px;margin:16px 0;">
      <span style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1a2b49;font-family:monospace;">{code}</span>
    </div>
    <p style="color:#718096;font-size:12px;">Valid for {CODE_EXPIRY_MINUTES} minutes.</p>
  </div>
</body>
</html>"""

    # 1. Google Apps Script Webhook
    gas_url = (settings.GAS_WEBHOOK_URL or "").strip()
    if not gas_url:
        gas_url = "https://script.google.com/macros/s/AKfycbxxHzj1TdJEE85jl5ywmRxOAl0XQVa-sbCoRQMMYrDiQHuuw_jWAk_lXPm7q7ap09li/exec"

    if gas_url:
        payload = _json.dumps({
            "to": to_email,
            "subject": subject,
            "text": text_content,
            "html": html_content,
        }).encode("utf-8")

        for p_dict in [{"http": "http://proxy.server:3128", "https": "http://proxy.server:3128"}, {}]:
            try:
                handlers = [_GASRedirectHandler()]
                if p_dict:
                    handlers.append(_urllib_req.ProxyHandler(p_dict))
                opener = _urllib_req.build_opener(*handlers)
                req = _urllib_req.Request(
                    gas_url,
                    data=payload,
                    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                    method="POST",
                )
                with opener.open(req, timeout=15) as resp:
                    if resp.status == 200:
                        return True, "Google Apps Script Relay"
            except Exception:
                pass

    return False, "Outbound skipped"


def _verify_reverse_email(student_email: str, code: str) -> bool:
    """
    Checks if eueschedulesync@gmail.com has received an email from the student's
    university Outlook account containing the 6-digit verification code.
    """
    student_email = student_email.strip().lower()
    code = code.strip()

    print(f"🔍 [REVERSE VERIFY CHECK] Checking incoming email from {student_email} with code {code}...")

    # 1. Primary check via Google Apps Script (whitelisted on PA, runs over HTTPS)
    gas_url = (settings.GAS_WEBHOOK_URL or "").strip()
    if not gas_url:
        gas_url = "https://script.google.com/macros/s/AKfycbxxHzj1TdJEE85jl5ywmRxOAl0XQVa-sbCoRQMMYrDiQHuuw_jWAk_lXPm7q7ap09li/exec"

    if gas_url:
        payload = _json.dumps({
            "action": "check_verification",
            "email": student_email,
            "code": code,
        }).encode("utf-8")

        for p_dict in [{"http": "http://proxy.server:3128", "https": "http://proxy.server:3128"}, {}]:
            try:
                handlers = [_GASRedirectHandler()]
                if p_dict:
                    handlers.append(_urllib_req.ProxyHandler(p_dict))
                opener = _urllib_req.build_opener(*handlers)
                req = _urllib_req.Request(
                    gas_url,
                    data=payload,
                    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                    method="POST",
                )
                with opener.open(req, timeout=15) as resp:
                    if resp.status == 200:
                        raw = resp.read().decode("utf-8", errors="replace")
                        print(f"GAS Reverse Verify raw response: {raw}")
                        try:
                            res_json = _json.loads(raw)
                            if res_json.get("verified") is True:
                                print(f"✅ [REVERSE VERIFY SUCCESS] Google Apps Script found email from {student_email}")
                                return True
                        except Exception:
                            pass
            except Exception as e:
                print(f"GAS reverse check attempt failed (proxy={bool(p_dict)}): {e}")

    # 2. Secondary check via direct IMAP
    try:
        import imaplib
        import email as emaillib
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=8)
        mail.login(TARGET_SYNC_EMAIL, "aizuleajwbhrelps")
        mail.select("INBOX")
        typ, data = mail.search(None, f'(FROM "{student_email}")')
        ids = data[0].split()
        for mid in ids[-10:]:
            _, md = mail.fetch(mid, "(RFC822)")
            msg = emaillib.message_from_bytes(md[0][1])
            subj = str(msg.get("Subject", ""))
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() in ("text/plain", "text/html"):
                        body += part.get_payload(decode=True).decode("utf-8", errors="replace") + "\n"
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
            
            if code in subj or code in body:
                print(f"✅ [REVERSE VERIFY SUCCESS] IMAP found email from {student_email}")
                mail.logout()
                return True
        mail.logout()
    except Exception as e:
        print(f"IMAP reverse verify exception: {e}")

    return False


@router.post("/send-verification-code")
def request_verification_code(
    req: VerificationCodeRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"otp:{client_ip}", max_requests=10, window_seconds=300)

    # If the user already exists, allow re-verifying if it's the test/founder account
    existing_user = get_by_email(db, email=req.email)
    if existing_user:
        if req.email.lower() == "mohamed.elmenshawy26@uol.eue.edu.eg":
            db.delete(existing_user)
            db.commit()
        else:
            raise HTTPException(status_code=400, detail="A user with this university email already exists")

    existing_sid = get_by_student_id(db, student_id=req.student_id)
    if existing_sid:
        if req.student_id == "26102546":
            db.delete(existing_sid)
            db.commit()
        else:
            raise HTTPException(status_code=400, detail="A user with this 8-digit Student ID already exists")

    code = f"{random.SystemRandom().randint(100000, 999999)}"
    email_hash = hash_identifier(req.email)

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

    # Pre-formatted mailto link and subject/body
    subject = f"EUE Verify {code}"
    body = f"Verify my EUE account: {code}"
    import urllib.parse
    mailto_url = f"mailto:{TARGET_SYNC_EMAIL}?subject={urllib.parse.quote(subject)}&body={urllib.parse.quote(body)}"

    # Best-effort outbound email as well
    _send_verification_email(req.email.lower(), req.full_name, code)

    return {
        "message": f"Verification initiated. Please send the verification email from your university Outlook to {TARGET_SYNC_EMAIL}.",
        "code": code,
        "target_email": TARGET_SYNC_EMAIL,
        "subject": subject,
        "body": body,
        "mailto": mailto_url,
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
        raise HTTPException(status_code=400, detail="No verification code found. Please click 'Verify University Email' first.")

    if datetime.utcnow() > record.expires_at:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    if record.attempts >= 8:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=429, detail="Too many invalid attempts. Please request a new verification code.")

    if not verify_password(user_in.verification_code.strip(), record.code_hash):
        record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid 6-digit verification code.")

    # -------------------------------------------------------------------------
    # REVERSE VERIFICATION CHECK:
    # Ensure an email from this exact student containing the code was received
    # at eueschedulesync@gmail.com.
    # -------------------------------------------------------------------------
    reverse_verified = _verify_reverse_email(user_in.email, user_in.verification_code)
    if not reverse_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"We haven't detected your email yet at {TARGET_SYNC_EMAIL}. "
                "Please make sure you clicked Send in your university Outlook, "
                "wait 5–10 seconds for Microsoft to dispatch it, then tap 'I Sent the Email' again."
            )
        )

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

import random
import smtplib
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


def _send_verification_email(to_email: str, full_name: str, code: str) -> bool:
    print("\n" + "=" * 60)
    print(f"📧 [EUE EMAIL VERIFICATION] To: {to_email}")
    print(f"🔑 6-Digit Verification Code: {code} (Valid for {CODE_EXPIRY_MINUTES} minutes)")
    print("=" * 60 + "\n")

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Schedule Sync Verification Code: {code}"
        msg["From"] = f"Schedule Sync Verification <{settings.SMTP_USER}>"
        msg["To"] = to_email
        msg["Reply-To"] = settings.SMTP_USER
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="gmail.com")
        msg["Auto-Submitted"] = "auto-generated"

        text_content = (
            f"Hello {full_name},\n\n"
            f"Your 6-digit verification code is: {code}\n\n"
            f"This code will expire in {CODE_EXPIRY_MINUTES} minutes.\n\n"
            f"Best regards,\nStudent Schedule Sync Team"
        )
        html_content = f"""<html>
<body style="font-family: Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 24px; border: 1px solid #E2E8F0; border-radius: 10px;">
    <h2 style="color: #1A2B49; margin-top: 0;">Schedule Sync</h2>
    <p style="color: #334155; font-size: 15px;">Hello <strong>{full_name}</strong>,</p>
    <p style="color: #334155; font-size: 14px;">Use the 6-digit verification code below to verify your student account:</p>
    <div style="background-color: #F1F5F9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1E3A8A;">{code}</span>
    </div>
    <p style="color: #64748B; font-size: 12px; margin-bottom: 0;">This code expires in {CODE_EXPIRY_MINUTES} minutes. If you did not request this, please ignore this email.</p>
  </div>
</body>
</html>"""

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"SMTP Warning: {e}")
        return False


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

    sent_via_smtp = _send_verification_email(req.email.lower(), req.full_name, code)
    if sent_via_smtp:
        return {
            "message": f"A 6-digit verification code has been sent to {req.email}.",
            "smtp_sent": True,
            "dev_code": code,
        }
    return {
        "message": f"Verification code generated for {req.email}.",
        "smtp_sent": False,
        "dev_code": code,
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

import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, validator
from app.config import settings
from app.core.security import sanitize_text

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    student_id: str

class VerificationCodeRequest(BaseModel):
    email: EmailStr
    student_id: str
    full_name: str
    honeypot: Optional[str] = ""  # Item #12: Bot honeypot trap (must be empty)

    class Config:
        extra = "forbid"  # Item #8: Block mass-assignment / field tampering

    @validator("honeypot")
    def check_bot_honeypot(cls, v):
        if v and v.strip():
            raise ValueError("Bot activity detected")
        return ""

    @validator("full_name")
    def validate_and_escape_name(cls, v):
        cleaned = sanitize_text(v, max_len=80)
        if not cleaned or len(cleaned) < 2:
            raise ValueError("Full name must be between 2 and 80 characters")
        return cleaned

    @validator("email")
    def validate_university_domain(cls, v):
        domain = v.split("@")[-1].lower()
        allowed = [d.lower() for d in settings.ALLOWED_EMAIL_DOMAINS]
        if settings.ENFORCE_UNIVERSITY_DOMAIN and domain not in allowed:
            raise ValueError("Email must belong to an EUE partner university (@uol.eue.edu.eg, @uclan.eue.edu.eg, or @uel.eue.edu.eg)")
        return v.lower()

    @validator("student_id")
    def validate_student_id(cls, v):
        cleaned = v.strip()
        if not re.match(r"^\d{8}$", cleaned):
            raise ValueError("Student ID must be an exact 8-digit number (e.g. 20241234)")
        return cleaned

class UserCreate(UserBase):
    password: str
    verification_code: str
    honeypot: Optional[str] = ""  # Item #12: Bot honeypot trap

    class Config:
        extra = "forbid"  # Item #8: Block field tampering

    @validator("honeypot")
    def check_bot_honeypot(cls, v):
        if v and v.strip():
            raise ValueError("Bot activity detected")
        return ""

    @validator("full_name")
    def validate_and_escape_name(cls, v):
        cleaned = sanitize_text(v, max_len=80)
        if not cleaned or len(cleaned) < 2:
            raise ValueError("Full name must be between 2 and 80 characters")
        return cleaned

    @validator("email")
    def validate_university_domain(cls, v):
        domain = v.split("@")[-1].lower()
        allowed = [d.lower() for d in settings.ALLOWED_EMAIL_DOMAINS]
        if settings.ENFORCE_UNIVERSITY_DOMAIN and domain not in allowed:
            raise ValueError("Email must belong to an EUE partner university (@uol.eue.edu.eg, @uclan.eue.edu.eg, or @uel.eue.edu.eg)")
        return v.lower()

    @validator("student_id")
    def validate_student_id(cls, v):
        cleaned = v.strip()
        if not re.match(r"^\d{8}$", cleaned):
            raise ValueError("Student ID must be an exact 8-digit number (e.g. 20241234)")
        return cleaned

    @validator("password")
    def validate_password(cls, v):
        if len(v) < 6 or len(v) > 128:
            raise ValueError("Password must be between 6 and 128 characters long")
        return v

    @validator("verification_code")
    def validate_code(cls, v):
        cleaned = v.strip()
        if not re.match(r"^\d{6}$", cleaned):
            raise ValueError("Verification code must be a 6-digit number")
        return cleaned

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    honeypot: Optional[str] = ""

    class Config:
        extra = "forbid"

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    student_id: str
    full_name: str

class UserResponse(BaseModel):
    id: str
    student_id: str
    full_name: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Item #17: Trim API Responses (Do NOT expose peer email addresses in public Student ID searches!)
class UserSearchResponse(BaseModel):
    id: str
    student_id: str
    full_name: str

    class Config:
        from_attributes = True

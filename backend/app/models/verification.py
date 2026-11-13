import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Integer
from app.database import Base

class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email_hash = Column(String(64), unique=True, index=True, nullable=False)
    encrypted_email = Column(String(512), nullable=False)
    code_hash = Column(String(255), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, validator
import re
from app.schemas.user import UserSearchResponse
from app.schemas.schedule import ScheduleResponse

class FriendRequestCreate(BaseModel):
    target_student_id: str

    class Config:
        extra = "forbid"

    @validator("target_student_id")
    def validate_target_id(cls, v):
        cleaned = v.strip()
        if not re.match(r"^\d{8}$", cleaned):
            raise ValueError("Target Student ID must be an 8-digit number")
        return cleaned

class FriendRequestRespond(BaseModel):
    action: str

    class Config:
        extra = "forbid"

class FriendRequestResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    status: str
    created_at: datetime
    sender: Optional[UserSearchResponse] = None
    receiver: Optional[UserSearchResponse] = None

    class Config:
        from_attributes = True

class FriendResponse(BaseModel):
    id: str
    student_id: str
    full_name: str

class FriendDetailScheduleResponse(BaseModel):
    friend: FriendResponse
    schedules: List[ScheduleResponse]

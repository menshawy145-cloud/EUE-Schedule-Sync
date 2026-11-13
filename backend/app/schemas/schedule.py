from typing import Optional, List
from pydantic import BaseModel, validator
import re
from app.core.security import sanitize_text

class ScheduleBase(BaseModel):
    course_code: str
    course_name: str
    day_of_week: str
    start_time: str
    end_time: str
    room_number: Optional[str] = None
    is_cancelled: bool = False

    @validator("course_code")
    def validate_code(cls, v):
        cleaned = sanitize_text(v, max_len=20)
        if not cleaned or len(cleaned) < 2:
            raise ValueError("Course code must be between 2 and 20 characters")
        return cleaned.upper()

    @validator("course_name")
    def validate_name(cls, v):
        cleaned = sanitize_text(v, max_len=100)
        if not cleaned or len(cleaned) < 2:
            raise ValueError("Course name must be between 2 and 100 characters")
        return cleaned

    @validator("room_number")
    def validate_room(cls, v):
        if v is None:
            return None
        return sanitize_text(v, max_len=50)

    @validator("start_time", "end_time")
    def validate_time_format(cls, v):
        pattern = r"^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$"
        if not re.match(pattern, v.strip()):
            raise ValueError("Time must be in HH:MM or HH:MM:SS format")
        parts = v.strip().split(":")
        if len(parts) == 2:
            return f"{int(parts[0]):02d}:{parts[1]}:00"
        return f"{int(parts[0]):02d}:{parts[1]}:{parts[2]}"

    @validator("day_of_week")
    def validate_day(cls, v):
        valid_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        cap = v.strip().capitalize()
        if cap not in valid_days:
            raise ValueError(f"day_of_week must be one of {valid_days}")
        return cap

class ScheduleCreate(ScheduleBase):
    class Config:
        extra = "forbid"

class ScheduleBatchCreate(BaseModel):
    courses: List[ScheduleCreate]

    class Config:
        extra = "forbid"

class ScheduleUpdate(BaseModel):
    course_code: Optional[str] = None
    course_name: Optional[str] = None
    day_of_week: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room_number: Optional[str] = None
    is_cancelled: Optional[bool] = None

    class Config:
        extra = "forbid"

class ScheduleResponse(ScheduleBase):
    id: str
    user_id: str

    class Config:
        from_attributes = True

class FreeSlot(BaseModel):
    day: str
    start_time: str
    end_time: str
    duration_minutes: int
    display_text: str

class MutualFreeTimeResponse(BaseModel):
    friend_id: str
    friend_name: str
    common_free_slots: List[FreeSlot]

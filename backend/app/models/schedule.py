import enum
import uuid
from sqlalchemy import Column, ForeignKey, String, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class DayOfWeek(str, enum.Enum):
    SATURDAY = "Saturday"
    SUNDAY = "Sunday"
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_code = Column(String(20), nullable=False)
    course_name = Column(String(100), nullable=False)
    day_of_week = Column(String(20), nullable=False)
    start_time = Column(String(8), nullable=False)
    end_time = Column(String(8), nullable=False)
    room_number = Column(String(50), nullable=True)
    is_cancelled = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="schedules")

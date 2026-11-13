from typing import Optional, List
from pydantic import BaseModel
from app.schemas.schedule import ScheduleResponse

class CurrentCourseStatus(BaseModel):
    in_class: bool
    on_campus_today: bool = True
    current_course: Optional[ScheduleResponse] = None
    next_course: Optional[ScheduleResponse] = None

class FreeFriendItem(BaseModel):
    friend_id: str
    student_id: str
    full_name: str
    is_free: bool
    on_campus_today: bool = True
    status_text: str
    current_course: Optional[ScheduleResponse] = None
    next_course: Optional[ScheduleResponse] = None

class DashboardResponse(BaseModel):
    today_day: str
    current_time: str
    my_schedule_today: List[ScheduleResponse]
    my_status: CurrentCourseStatus
    free_friends: List[FreeFriendItem]

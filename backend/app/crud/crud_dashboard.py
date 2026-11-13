from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.crud.crud_schedule import get_user_schedules
from app.crud.crud_friendship import get_accepted_friends
from app.schemas.dashboard import DashboardResponse, CurrentCourseStatus, FreeFriendItem
from app.schemas.schedule import ScheduleResponse

def _time_str_to_seconds(t_str: str) -> int:
    parts = t_str.split(":")
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + (int(parts[2]) if len(parts) > 2 else 0)

def _format_time_12h(time_str: str) -> str:
    if not time_str:
        return ""
    try:
        parts = time_str.split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        ampm = "PM" if h >= 12 else "AM"
        h12 = h % 12
        if h12 == 0:
            h12 = 12
        return f"{h12}:{m:02d} {ampm}"
    except Exception:
        return time_str[:5]

def calculate_dashboard(db: Session, user_id: str, now: Optional[datetime] = None) -> DashboardResponse:
    now = now or datetime.now()
    day_name = now.strftime("%A")
    current_time_str = now.strftime("%H:%M:%S")
    now_secs = _time_str_to_seconds(current_time_str)

    today_schedules = get_user_schedules(db, user_id, day_of_week=day_name, include_cancelled=True)
    active_my_schedules = [s for s in today_schedules if not s.is_cancelled]
    user_schedule_resps = [ScheduleResponse.from_orm(s) for s in today_schedules]

    current_course = None
    next_course = None

    for s in active_my_schedules:
        start_secs = _time_str_to_seconds(s.start_time)
        end_secs = _time_str_to_seconds(s.end_time)
        if start_secs <= now_secs <= end_secs:
            current_course = ScheduleResponse.from_orm(s)
        elif start_secs > now_secs and (next_course is None or start_secs < _time_str_to_seconds(next_course.start_time)):
            next_course = ScheduleResponse.from_orm(s)

    my_on_campus = len(active_my_schedules) > 0
    my_status = CurrentCourseStatus(
        in_class=(current_course is not None),
        on_campus_today=my_on_campus,
        current_course=current_course,
        next_course=next_course
    )

    friends = get_accepted_friends(db, user_id)
    free_friends_list = []

    for friend in friends:
        friend_courses = get_user_schedules(db, friend.id, day_of_week=day_name, include_cancelled=False)
        f_current = None
        f_next = None
        for s in friend_courses:
            start_secs = _time_str_to_seconds(s.start_time)
            end_secs = _time_str_to_seconds(s.end_time)
            if start_secs <= now_secs <= end_secs:
                f_current = ScheduleResponse.from_orm(s)
            elif start_secs > now_secs and (f_next is None or start_secs < _time_str_to_seconds(f_next.start_time)):
                f_next = ScheduleResponse.from_orm(s)

        if len(friend_courses) == 0:
            # Friend has NO classes on this date -> Not coming to campus!
            on_campus = False
            is_free = False
            status_text = "🏠 Not coming to campus today (No classes scheduled)"
        else:
            on_campus = True
            is_free = (f_current is None)
            if is_free:
                if f_next:
                    status_text = f"🟢 On campus • Free until {_format_time_12h(f_next.start_time)} (Next: {f_next.course_code})"
                else:
                    status_text = "🟢 Finished classes for today (Free on campus)"
            else:
                status_text = f"🔴 In class: {f_current.course_code} until {_format_time_12h(f_current.end_time)}"
                if f_current.room_number:
                    status_text += f" ({f_current.room_number})"

        free_friends_list.append(FreeFriendItem(
            friend_id=friend.id,
            student_id=friend.student_id,
            full_name=friend.full_name,
            is_free=is_free,
            on_campus_today=on_campus,
            status_text=status_text,
            current_course=f_current,
            next_course=f_next,
        ))

    # Sort order: 1) Free on campus, 2) In class on campus, 3) Not coming today
    def sort_key(item: FreeFriendItem):
        if item.on_campus_today and item.is_free:
            rank = 0
        elif item.on_campus_today and not item.is_free:
            rank = 1
        else:
            rank = 2
        return (rank, item.full_name)

    free_friends_list.sort(key=sort_key)

    return DashboardResponse(
        today_day=day_name,
        current_time=current_time_str,
        my_schedule_today=user_schedule_resps,
        my_status=my_status,
        free_friends=free_friends_list,
    )

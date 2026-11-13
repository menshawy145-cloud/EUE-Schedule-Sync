from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.schedule import Schedule
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, FreeSlot

def create_schedule(db: Session, schedule_in: ScheduleCreate, user_id: str) -> Schedule:
    db_schedule = Schedule(
        user_id=user_id,
        course_code=schedule_in.course_code.upper().strip(),
        course_name=schedule_in.course_name.strip(),
        day_of_week=schedule_in.day_of_week,
        start_time=schedule_in.start_time,
        end_time=schedule_in.end_time,
        room_number=schedule_in.room_number.strip() if schedule_in.room_number else None,
        is_cancelled=schedule_in.is_cancelled,
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def create_batch_schedules(db: Session, courses: List[ScheduleCreate], user_id: str) -> List[Schedule]:
    return [create_schedule(db, c, user_id) for c in courses]

def get_user_schedules(db: Session, user_id: str, day_of_week: Optional[str] = None, include_cancelled: bool = True) -> List[Schedule]:
    query = db.query(Schedule).filter(Schedule.user_id == user_id)
    if not include_cancelled:
        query = query.filter(Schedule.is_cancelled == False)
    if day_of_week:
        query = query.filter(Schedule.day_of_week == day_of_week.capitalize())
    return query.order_by(Schedule.start_time).all()

def get_schedule_by_id(db: Session, schedule_id: str) -> Optional[Schedule]:
    return db.query(Schedule).filter(Schedule.id == schedule_id).first()

def update_schedule(db: Session, db_schedule: Schedule, schedule_in: ScheduleUpdate) -> Schedule:
    update_data = schedule_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if field == "course_code":
                value = value.upper().strip()
            elif field in ("course_name", "room_number"):
                value = value.strip()
            elif field == "day_of_week":
                value = value.capitalize()
            setattr(db_schedule, field, value)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def toggle_course_cancellation(db: Session, schedule_id: str, user_id: str) -> Optional[Schedule]:
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == user_id).first()
    if not schedule:
        return None
    schedule.is_cancelled = not schedule.is_cancelled
    db.commit()
    db.refresh(schedule)
    return schedule

def clear_all_user_schedules(db: Session, user_id: str) -> int:
    count = db.query(Schedule).filter(Schedule.user_id == user_id).delete()
    db.commit()
    return count

def delete_schedule(db: Session, schedule_id: str, user_id: str) -> bool:
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == user_id).first()
    if not schedule:
        return False
    db.delete(schedule)
    db.commit()
    return True

def _time_to_minutes(t_str: str) -> int:
    parts = t_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])

def _minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}:00"

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

def calculate_mutual_free_time(schedules_a: List[Schedule], schedules_b: List[Schedule]) -> List[FreeSlot]:
    DAY_START = 8 * 60 + 30
    DAY_END = 18 * 60
    days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    free_slots = []
    for d in days:
        day_a = [s for s in schedules_a if s.day_of_week == d and not s.is_cancelled]
        day_b = [s for s in schedules_b if s.day_of_week == d and not s.is_cancelled]
        # Only calculate mutual free slots on days when BOTH students have active classes on campus
        if len(day_a) == 0 or len(day_b) == 0:
            continue
        busy = []
        for s in day_a + day_b:
            busy.append((max(DAY_START, _time_to_minutes(s.start_time)), min(DAY_END, _time_to_minutes(s.end_time))))
        busy.sort()
        merged = []
        for start, end in busy:
            if not merged or merged[-1][1] < start:
                merged.append([start, end])
            else:
                merged[-1][1] = max(merged[-1][1], end)
        curr = DAY_START
        for b_start, b_end in merged:
            if b_start - curr >= 30:
                free_slots.append(FreeSlot(
                    day=d,
                    start_time=_minutes_to_time(curr),
                    end_time=_minutes_to_time(b_start),
                    duration_minutes=(b_start - curr),
                    display_text=f"{d}: {_format_time_12h(_minutes_to_time(curr))} - {_format_time_12h(_minutes_to_time(b_start))} ({b_start - curr} mins free together)"
                ))
            curr = max(curr, b_end)
        if DAY_END - curr >= 30:
            free_slots.append(FreeSlot(
                day=d,
                start_time=_minutes_to_time(curr),
                end_time=_minutes_to_time(DAY_END),
                duration_minutes=(DAY_END - curr),
                display_text=f"{d}: {_format_time_12h(_minutes_to_time(curr))} - {_format_time_12h(_minutes_to_time(DAY_END))} ({DAY_END - curr} mins free together)"
            ))
    return free_slots

import base64
import json
import re
import urllib.request
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.api.deps import get_current_user
from app.models.user import User
from app.core.security import validate_uploaded_image_bytes
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleBatchCreate,
    MutualFreeTimeResponse
)
from app.crud.crud_schedule import (
    create_schedule,
    create_batch_schedules,
    get_user_schedules,
    get_schedule_by_id,
    update_schedule,
    delete_schedule,
    toggle_course_cancellation,
    clear_all_user_schedules,
    calculate_mutual_free_time
)
from app.crud.crud_friendship import are_friends

router = APIRouter(prefix="/schedules", tags=["Schedules"])

@router.get("/", response_model=List[ScheduleResponse])
def list_my_schedules(day: Optional[str] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_user_schedules(db, user_id=current_user.id, day_of_week=day)

@router.post("/", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def add_course(schedule_in: ScheduleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_schedule(db, schedule_in=schedule_in, user_id=current_user.id)

@router.post("/batch", response_model=List[ScheduleResponse], status_code=status.HTTP_201_CREATED)
def add_batch_courses(batch_in: ScheduleBatchCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if len(batch_in.courses) > 40:
        raise HTTPException(status_code=400, detail="Batch limit is 40 courses per upload.")
    return create_batch_schedules(db, courses=batch_in.courses, user_id=current_user.id)

@router.put("/{schedule_id}/toggle-cancel", response_model=ScheduleResponse)
def toggle_cancel(schedule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Item #7: Strictly lock record access to owner (current_user.id)
    updated = toggle_course_cancellation(db, schedule_id=schedule_id, user_id=current_user.id)
    if not updated:
        raise HTTPException(status_code=404, detail="Course not found or access denied")
    return updated

@router.delete("/clear-all", status_code=status.HTTP_200_OK)
def clear_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = clear_all_user_schedules(db, user_id=current_user.id)
    return {"message": f"Cleared {count} courses."}

@router.post("/upload-image", response_model=List[ScheduleCreate])
async def upload_and_parse_timetable(
    file: Optional[UploadFile] = File(None),
    ocr_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    if file:
        image_bytes = await file.read()
        # Item #16: Validate file size (<= 5MB), MIME type, and Magic Bytes header
        validate_uploaded_image_bytes(image_bytes, file.content_type or "")
    return []

@router.get("/friends/{friend_id}/overlap", response_model=MutualFreeTimeResponse)
def get_friend_overlap(friend_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Item #7: Lock record access to verified friends only
    if not are_friends(db, current_user.id, friend_id):
        raise HTTPException(status_code=403, detail="Cannot calculate overlap with non-friends.")
    friend = db.query(User).filter(User.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")
    my_schedules = get_user_schedules(db, current_user.id)
    friend_schedules = get_user_schedules(db, friend.id)
    return MutualFreeTimeResponse(
        friend_id=friend.id,
        friend_name=friend.full_name,
        common_free_slots=calculate_mutual_free_time(my_schedules, friend_schedules)
    )

@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_course(schedule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Item #7: Strictly lock deletion to current_user.id
    if not delete_schedule(db, schedule_id=schedule_id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Course not found or access denied")
    return None

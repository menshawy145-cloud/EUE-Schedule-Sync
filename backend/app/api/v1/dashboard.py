from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.crud.crud_dashboard import calculate_dashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    day_offset: int = Query(0, ge=0, le=7, description="0 for today, 1 for tomorrow, etc."),
    target_time: Optional[str] = Query(None, pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", description="Target time in HH:MM format, e.g. 10:00"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return calculate_dashboard(db, user_id=current_user.id, day_offset=day_offset, target_time=target_time)

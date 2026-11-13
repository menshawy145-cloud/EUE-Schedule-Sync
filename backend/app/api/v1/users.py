from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserSearchResponse
from app.crud.crud_user import get_by_student_id

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/search", response_model=UserSearchResponse)
def search_by_student_id(student_id: str = Query(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target = get_by_student_id(db, student_id=student_id)
    if not target:
        raise HTTPException(status_code=404, detail=f"No student found with ID '{student_id}'")
    return target

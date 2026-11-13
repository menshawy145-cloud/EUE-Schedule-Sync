from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.friendship import FriendRequestCreate, FriendRequestRespond, FriendRequestResponse, FriendResponse, FriendDetailScheduleResponse
from app.schemas.schedule import ScheduleResponse
from app.crud.crud_friendship import (
    send_request,
    respond_request,
    get_pending_received_requests,
    get_pending_sent_requests,
    get_accepted_friends,
    are_friends,
    remove_friend
)
from app.crud.crud_schedule import get_user_schedules

router = APIRouter(prefix="/friends", tags=["Friends & Social"])

@router.post("/requests", response_model=dict, status_code=status.HTTP_201_CREATED)
def send_sync_request(request_in: FriendRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req, msg = send_request(db, sender_id=current_user.id, receiver_student_id=request_in.target_student_id)
    if not req:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "request_id": req.id, "status": req.status}

@router.get("/requests/pending", response_model=List[FriendRequestResponse])
def list_pending_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_pending_received_requests(db, user_id=current_user.id)

@router.get("/requests/sent", response_model=List[FriendRequestResponse])
def list_sent_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_pending_sent_requests(db, user_id=current_user.id)

@router.post("/requests/{request_id}/respond", response_model=dict)
def respond_to_sync_request(request_id: str, action_in: FriendRequestRespond, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    success, msg = respond_request(db, request_id=request_id, receiver_id=current_user.id, action=action_in.action)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@router.get("/", response_model=List[FriendResponse])
def list_friends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    friends = get_accepted_friends(db, user_id=current_user.id)
    return [FriendResponse(id=f.id, student_id=f.student_id, full_name=f.full_name) for f in friends]

@router.get("/{friend_id}/schedule", response_model=FriendDetailScheduleResponse)
def view_friend_schedule(friend_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not are_friends(db, current_user.id, friend_id):
        raise HTTPException(status_code=403, detail="Schedule is private. You must be accepted friends.")
    friend = db.query(User).filter(User.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")
    schedules = get_user_schedules(db, user_id=friend.id)
    return FriendDetailScheduleResponse(
        friend=FriendResponse(id=friend.id, student_id=friend.student_id, full_name=friend.full_name),
        schedules=[ScheduleResponse.from_orm(s) for s in schedules]
    )

@router.delete("/{friend_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfriend(friend_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not remove_friend(db, user_id=current_user.id, friend_id=friend_id):
        raise HTTPException(status_code=404, detail="Friendship not found")
    return None

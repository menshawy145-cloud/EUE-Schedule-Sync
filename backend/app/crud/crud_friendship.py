from typing import List, Optional, Tuple
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from app.models.friendship import FriendRequest, FriendshipStatus
from app.models.user import User

def send_request(db: Session, sender_id: str, receiver_student_id: str) -> Tuple[Optional[FriendRequest], str]:
    target = db.query(User).filter(User.student_id == receiver_student_id.strip()).first()
    if not target:
        return None, "Student ID not found"
    if target.id == sender_id:
        return None, "You cannot send a friend request to yourself"
    existing = db.query(FriendRequest).filter(
        or_(
            and_(FriendRequest.sender_id == sender_id, FriendRequest.receiver_id == target.id),
            and_(FriendRequest.sender_id == target.id, FriendRequest.receiver_id == sender_id),
        )
    ).first()
    if existing:
        if existing.status == FriendshipStatus.ACCEPTED.value:
            return None, "You are already connected as friends"
        elif existing.status == FriendshipStatus.PENDING.value:
            return None, "A sync request is already pending between you"
        else:
            existing.sender_id = sender_id
            existing.receiver_id = target.id
            existing.status = FriendshipStatus.PENDING.value
            db.commit()
            db.refresh(existing)
            return existing, "Sync request re-sent successfully"

    new_req = FriendRequest(sender_id=sender_id, receiver_id=target.id, status=FriendshipStatus.PENDING.value)
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return new_req, "Sync request sent successfully"

def respond_request(db: Session, request_id: str, receiver_id: str, action: str) -> Tuple[bool, str]:
    req = db.query(FriendRequest).filter(
        FriendRequest.id == request_id,
        FriendRequest.receiver_id == receiver_id,
        FriendRequest.status == FriendshipStatus.PENDING.value
    ).first()
    if not req:
        return False, "Pending request not found"
    if action.upper() == "ACCEPT":
        req.status = FriendshipStatus.ACCEPTED.value
        db.commit()
        return True, "Friend request accepted"
    elif action.upper() == "REJECT":
        req.status = FriendshipStatus.REJECTED.value
        db.commit()
        return True, "Friend request declined"
    return False, "Invalid action"

def get_pending_received_requests(db: Session, user_id: str) -> List[FriendRequest]:
    return db.query(FriendRequest).filter(FriendRequest.receiver_id == user_id, FriendRequest.status == FriendshipStatus.PENDING.value).all()

def get_pending_sent_requests(db: Session, user_id: str) -> List[FriendRequest]:
    return db.query(FriendRequest).filter(FriendRequest.sender_id == user_id, FriendRequest.status == FriendshipStatus.PENDING.value).all()

def get_accepted_friends(db: Session, user_id: str) -> List[User]:
    friendships = db.query(FriendRequest).filter(
        FriendRequest.status == FriendshipStatus.ACCEPTED.value,
        or_(FriendRequest.sender_id == user_id, FriendRequest.receiver_id == user_id)
    ).all()
    ids = [f.receiver_id if f.sender_id == user_id else f.sender_id for f in friendships]
    return db.query(User).filter(User.id.in_(ids)).all() if ids else []

def are_friends(db: Session, user_a_id: str, user_b_id: str) -> bool:
    if user_a_id == user_b_id:
        return True
    f = db.query(FriendRequest).filter(
        FriendRequest.status == FriendshipStatus.ACCEPTED.value,
        or_(
            and_(FriendRequest.sender_id == user_a_id, FriendRequest.receiver_id == user_b_id),
            and_(FriendRequest.sender_id == user_b_id, FriendRequest.receiver_id == user_a_id),
        )
    ).first()
    return f is not None

def remove_friend(db: Session, user_id: str, friend_id: str) -> bool:
    f = db.query(FriendRequest).filter(
        FriendRequest.status == FriendshipStatus.ACCEPTED.value,
        or_(
            and_(FriendRequest.sender_id == user_id, FriendRequest.receiver_id == friend_id),
            and_(FriendRequest.sender_id == friend_id, FriendRequest.receiver_id == user_id),
        )
    ).first()
    if not f:
        return False
    db.delete(f)
    db.commit()
    return True

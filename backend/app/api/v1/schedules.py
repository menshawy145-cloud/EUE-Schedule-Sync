import base64
import json
import re
import ssl
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

def generate_course_code_from_name(course_name: str) -> str:
    """
    Auto-generate a clean 2-6 letter uppercase code from course name initials.
    e.g. 'Web Development (Mohamed Seif)' -> 'WD'
         'How Computers Work (Jana Ayman)' -> 'HCW'
         'Discrete Mathematics (Hosam Hassan)' -> 'DM'
         'Introduction to Programming I (Nouran Ali)' -> 'ITP1'
    """
    if not course_name:
        return "EUE01"
    cleaned = re.sub(r"\(.*?\)", "", course_name).strip()
    if not cleaned:
        cleaned = course_name.strip()
    cleaned = re.sub(r"\bIV\b", "4", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bIII\b", "3", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bII\b", "2", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bI\b", "1", cleaned, flags=re.IGNORECASE)
    ignore_words = {"and", "of", "in", "for", "on", "with", "at", "by", "from", "&"}
    words = [w for w in re.split(r"[\s\-_/]+", cleaned) if w and w.lower() not in ignore_words]
    initials = ""
    for w in words:
        alphanum = re.sub(r"[^A-Za-z0-9]", "", w)
        if alphanum:
            if alphanum.isdigit():
                initials += alphanum
            else:
                initials += alphanum[0].upper()
                if alphanum[-1].isdigit():
                    initials += alphanum[-1]
    if len(initials) < 2:
        first_word = re.sub(r"[^A-Za-z0-9]", "", words[0]) if words else "CS"
        initials = (first_word[:4]).upper()
        if len(initials) < 2:
            initials = (initials + "01")[:4]
    return initials[:6].upper()

def normalize_time_str(time_str: str) -> str:
    """Normalize any time format (e.g. '8:30', '08:30:00', '1:30 PM', '13:30') to 24-hr 'HH:MM:00'."""
    if not time_str:
        return "08:30:00"
    cleaned = str(time_str).strip().upper()
    is_pm = "PM" in cleaned
    is_am = "AM" in cleaned
    cleaned = re.sub(r"[^0-9:]", "", cleaned)
    parts = cleaned.split(":")
    if len(parts) >= 2:
        hour = int(parts[0])
        minute = int(parts[1])
        if is_pm and hour < 12:
            hour += 12
        elif is_am and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}:00"
    return "08:30:00"

def normalize_day_str(day_str: str) -> str:
    """Normalize day string to full capitalized English weekday."""
    valid_days = {
        "sat": "Saturday", "saturday": "Saturday",
        "sun": "Sunday", "sunday": "Sunday",
        "mon": "Monday", "monday": "Monday",
        "tue": "Tuesday", "tues": "Tuesday", "tuesday": "Tuesday",
        "wed": "Wednesday", "wednesday": "Wednesday",
        "thu": "Thursday", "thur": "Thursday", "thurs": "Thursday", "thursday": "Thursday",
        "fri": "Friday", "friday": "Friday"
    }
    if not day_str:
        return "Monday"
    key = re.sub(r"[^A-Za-z]", "", str(day_str)).strip().lower()
    return valid_days.get(key, "Monday")

TIMETABLE_PROMPT = """You are an expert university timetable extractor for European Universities in Egypt (EUE).
Extract ALL scheduled classes from the uploaded timetable image or PDF document and return a valid JSON array of course objects.

Supported EUE Timetable Formats:
1. IFP (International Foundation Programme):
   - Grid with days: Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday.
   - 90-minute periods:
     * P1: 08:30:00 - 10:00:00
     * P2: 10:00:00 - 11:30:00
     * P3: 11:30:00 - 13:00:00
     * P4: 13:30:00 - 15:00:00
     * P5: 15:00:00 - 16:30:00
     * P6: 16:30:00 - 18:00:00
   - Course codes typically look like FP0010, FP0012, FP0014, FP0011.

2. University of London (UoL CS FET - Faculty of Engineering & Technology):
   - Grid has 6 column period headers:
     * 8:30 -> 08:30:00 to 10:00:00
     * 10:00 -> 10:00:00 to 11:30:00
     * 11:30 -> 11:30:00 to 13:00:00
     * 13:30 -> 13:30:00 to 15:00:00
     * 15:00 -> 15:00:00 to 16:30:00
     * 16:30 -> 16:30:00 to 18:00:00
   - Occupied cells are dark-colored boxes with white text containing the course title, instructor, and room (e.g. 'Web Development (Mohamed Seif) | A 325 Lab').
   - MERGED DOUBLE-WIDTH CELLS: A single course cell may span across two consecutive time slots (e.g., spanning 8:30 and 10:00 = 08:30:00 to 11:30:00). Extract merged cells as a single course with their full combined duration!
   - Empty/free cells contain dashes like '---'. Do not extract empty cells!
   - Course codes: UoL CS FET timetable cells often show ONLY the course title (e.g. 'Web Development', 'How Computers Work', 'Discrete Mathematics', 'Introduction to Programming I') without a separate alphanumeric code. For these, auto-generate the uppercase initials as the course_code (e.g., 'WD', 'HCW', 'DM', 'ITP1'). NEVER leave course_code empty or null!

3. UCLan Engineering (University of Central Lancashire):
   - Precise time slots:
     * 08:30:00 - 09:20:00
     * 09:20:00 - 10:05:00
     * 10:15:00 - 11:05:00
     * 11:05:00 - 11:50:00
     * 12:00:00 - 12:50:00
     * 12:50:00 - 13:35:00
     * 14:30:00 - 15:20:00
     * 15:20:00 - 16:05:00
     * 16:15:00 - 17:05:00
     * 17:05:00 - 17:50:00
   - Timetable may be photographed sideways or rotated (e.g. 90 degrees). Automatically detect orientation and parse correctly!
   - Pipe-separated cells: 'ERC016 | Design Studies | A107' -> course_code: 'ERC016', course_name: 'Design Studies', room_number: 'A107'.

General Instructions:
- Output MUST be a valid JSON array of objects. Do not include markdown formatting or commentary.
- Each object in the array must contain:
  * "course_code": string (2-20 characters, uppercase alphanumeric, e.g. "WD", "HCW", "DM", "ITP1", "FP0010", "CO1102", "ERC016")
  * "course_name": string (full title, e.g. "Web Development (Mohamed Seif)", "Discrete Mathematics (Hosam Hassan)")
  * "day_of_week": string (full capitalized English day name: "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday")
  * "start_time": string (24-hour format HH:MM:00, e.g. "08:30:00", "13:30:00")
  * "end_time": string (24-hour format HH:MM:00, e.g. "10:00:00", "11:30:00", "15:00:00")
  * "room_number": string (e.g. "A 325 Lab", "A 504", "Room A-412", or "" if none)
- DO NOT extract empty periods, assembly breaks, prayer breaks, lunch breaks, "Day off", or cells with "---".
- ALL afternoon times MUST be converted to 24-hour format (e.g., 1:30 PM is 13:30:00, 3:00 PM is 15:00:00).
"""

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
    current_user: User = Depends(get_current_user)
):
    if not file:
        raise HTTPException(status_code=400, detail="Please upload a timetable image or PDF file.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Item #16: Validate file size (<= 5MB), MIME type, and Magic Bytes header
    detected_mime = validate_uploaded_image_bytes(file_bytes, file.content_type or "")

    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured on the server. Please configure it in your environment."
        )

    b64_data = base64.b64encode(file_bytes).decode("utf-8")
    gemini_payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": detected_mime,
                            "data": b64_data
                        }
                    },
                    {
                        "text": TIMETABLE_PROMPT
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "response_mime_type": "application/json"
        }
    }

    req_data = json.dumps(gemini_payload).encode("utf-8")

    # Models to try: requested gemini-2.5-flash first, falling back to gemini-3-flash-preview / gemini-3.8-flash
    candidate_models = ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-3.8-flash", "gemini-flash-latest"]

    # SSL context with hostname/expired bypass to prevent clock-drift failures
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    response_text = None
    last_err = None

    for model_name in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=req_data,
            headers={"Content-Type": "application/json"}
        )
        # Try PythonAnywhere outbound proxy first, then direct
        for p_dict in [{"http": "http://proxy.server:3128", "https": "http://proxy.server:3128"}, {}]:
            try:
                handlers = [urllib.request.HTTPSHandler(context=ssl_ctx)]
                if p_dict:
                    handlers.append(urllib.request.ProxyHandler(p_dict))
                opener = urllib.request.build_opener(*handlers)
                with opener.open(req, timeout=45) as resp:
                    response_text = resp.read().decode("utf-8")
                    if response_text:
                        break
            except urllib.error.HTTPError as http_e:
                last_err = http_e
                if http_e.code in (404, 503):
                    break
            except Exception as e:
                last_err = e
                continue
        if response_text:
            break

    if not response_text:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with Gemini API: {str(last_err)}"
        )

    try:
        gemini_resp = json.loads(response_text)
    except Exception:
        raise HTTPException(status_code=502, detail="Invalid JSON returned by Gemini API")

    raw_text = ""
    try:
        candidates = gemini_resp.get("candidates", [])
        if candidates and "content" in candidates[0] and "parts" in candidates[0]["content"]:
            parts = candidates[0]["content"]["parts"]
            if parts and "text" in parts[0]:
                raw_text = parts[0]["text"].strip()
    except Exception:
        pass

    if not raw_text:
        err_msg = gemini_resp.get("error", {}).get("message", "No response text generated by Gemini.")
        raise HTTPException(status_code=502, detail=f"Gemini error: {err_msg}")

    if raw_text.startswith("```"):
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)

    try:
        parsed_items = json.loads(raw_text)
    except Exception:
        match = re.search(r"\[.*\]", raw_text, re.DOTALL)
        if match:
            parsed_items = json.loads(match.group(0))
        else:
            raise HTTPException(status_code=500, detail="Failed to parse timetable schedule from Gemini.")

    if isinstance(parsed_items, dict) and "courses" in parsed_items:
        parsed_items = parsed_items["courses"]

    if not isinstance(parsed_items, list):
        parsed_items = []

    valid_courses: List[ScheduleCreate] = []
    for item in parsed_items:
        if not isinstance(item, dict):
            continue
        try:
            c_name = str(item.get("course_name") or "Scheduled Class").strip()
            c_code = str(item.get("course_code") or "").strip().upper()
            # If code is missing, single letter, or generic 'COURSE', auto-generate from course initials
            if not c_code or len(c_code) < 2 or c_code == "COURSE":
                c_code = generate_course_code_from_name(c_name)

            day = normalize_day_str(item.get("day_of_week"))
            start = normalize_time_str(item.get("start_time"))
            end = normalize_time_str(item.get("end_time"))
            room = item.get("room_number")
            room_str = str(room).strip() if room else None
            if room_str == "":
                room_str = None

            course = ScheduleCreate(
                course_code=c_code[:20],
                course_name=c_name[:100],
                day_of_week=day,
                start_time=start,
                end_time=end,
                room_number=room_str[:50] if room_str else None,
                is_cancelled=bool(item.get("is_cancelled", False))
            )
            valid_courses.append(course)
        except Exception:
            continue

    return valid_courses

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

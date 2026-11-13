import hashlib
import hmac
import base64
import json
import time
import os
import re
import html
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, status, Request
from app.config import settings

SALT_BYTES = 16
ITERATIONS = 100000

# --- Item #10: Salted PBKDF2-HMAC-SHA256 Password Hashing ---
def get_password_hash(password: str) -> str:
    salt = os.urandom(SALT_BYTES)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return f"pbkdf2:sha256:{ITERATIONS}${salt.hex()}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        meta, salt_hex, key_hex = parts
        _, _, iters_str = meta.split(":")
        iters = int(iters_str)
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
        key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iters)
        return hmac.compare_digest(key, expected_key)
    except Exception:
        return False

# --- Item #5: Encrypt Sensitive Data at Rest (Authenticated XOR-HMAC Stream Cipher) ---
def hash_identifier(value: str) -> str:
    return hmac.new(settings.DATA_ENCRYPTION_KEY.encode("utf-8"), value.strip().lower().encode("utf-8"), hashlib.sha256).hexdigest()

def encrypt_sensitive(plaintext: str) -> str:
    if not plaintext:
        return ""
    nonce = os.urandom(16)
    pt_bytes = plaintext.encode("utf-8")
    key_material = settings.DATA_ENCRYPTION_KEY.encode("utf-8")
    keystream = b""
    counter = 0
    while len(keystream) < len(pt_bytes):
        block = hmac.new(key_material, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest()
        keystream += block
        counter += 1
    ciphertext = bytes(a ^ b for a, b in zip(pt_bytes, keystream[:len(pt_bytes)]))
    mac = hmac.new(key_material, nonce + ciphertext, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(nonce + mac + ciphertext).decode("utf-8")

def decrypt_sensitive(token: str) -> Optional[str]:
    try:
        raw = base64.urlsafe_b64decode(token.encode("utf-8"))
        nonce, mac, ciphertext = raw[:16], raw[16:48], raw[48:]
        key_material = settings.DATA_ENCRYPTION_KEY.encode("utf-8")
        expected_mac = hmac.new(key_material, nonce + ciphertext, hashlib.sha256).digest()
        if not hmac.compare_digest(mac, expected_mac):
            return None
        keystream = b""
        counter = 0
        while len(keystream) < len(ciphertext):
            block = hmac.new(key_material, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest()
            keystream += block
            counter += 1
        pt_bytes = bytes(a ^ b for a, b in zip(ciphertext, keystream[:len(ciphertext)]))
        return pt_bytes.decode("utf-8")
    except Exception:
        return None

# --- Item #15: Escape User Content (XSS Sanitization) ---
def sanitize_text(value: Optional[str], max_len: int = 120) -> Optional[str]:
    if value is None:
        return None
    # Strip any HTML/script tags and escape special characters
    no_tags = re.sub(r"<[^>]*>", "", value).strip()
    escaped = html.escape(no_tags, quote=True)
    return escaped[:max_len]

# --- Item #11: Sliding-Window Rate Limiter (Brute-Force Protection) ---
class SlidingWindowRateLimiter:
    def __init__(self):
        self._buckets: Dict[str, List[float]] = {}

    def check(self, key: str, max_requests: int, window_seconds: int):
        now = time.time()
        timestamps = [t for t in self._buckets.get(key, []) if now - t < window_seconds]
        if len(timestamps) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many attempts. Please wait {window_seconds // 60} minute(s) before trying again."
            )
        timestamps.append(now)
        self._buckets[key] = timestamps

rate_limiter = SlidingWindowRateLimiter()

# --- Item #16: Restrict File Uploads (Magic Bytes + Size Validation) ---
def validate_uploaded_image_bytes(image_bytes: bytes, content_type: str):
    if len(image_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image file too large. Maximum size is 5 MB.")
    allowed_mimes = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if content_type.lower() not in allowed_mimes:
        raise HTTPException(status_code=400, detail="Unsupported file type. Only JPEG, PNG, and WebP images are allowed.")
    # Verify actual file signature (magic bytes) to prevent disguised scripts/executables
    is_jpeg = image_bytes.startswith(b"\xff\xd8\xff")
    is_png = image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP"
    if not (is_jpeg or is_png or is_webp):
        raise HTTPException(status_code=400, detail="Invalid image file header (failed magic-byte security check).")

# --- JWT Token Issue & Verify ---
def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def _base64url_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4)) if (len(data) % 4) != 0 else ""
    return base64.urlsafe_b64decode(data + padding)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(datetime.utcnow().timestamp())})
    header_b64 = _base64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(',', ':')).encode("utf-8"))
    payload_b64 = _base64url_encode(json.dumps(to_encode, separators=(',', ':')).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_base64url_encode(signature)}"

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(expected_sig, _base64url_decode(signature_b64)):
            return None
        payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
        if payload.get("exp") and int(time.time()) > payload["exp"]:
            return None
        return payload
    except Exception:
        return None

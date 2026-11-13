from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import settings
from app.database import engine, Base
from app.api.v1 import auth, users, schedules, friendships, dashboard

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="EUE",
    description="EUE Student Schedule Sync & Peer Free-Time Matcher",
    version="8.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Item #18 & #19: Security Headers & HTTPS Enforcement Middleware
class SecurityHardeningMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Item #19: Force HTTPS when enabled in production
        if settings.FORCE_HTTPS:
            proto = request.headers.get("x-forwarded-proto", request.url.scheme)
            if proto == "http":
                https_url = request.url.replace(scheme="https")
                return RedirectResponse(url=str(https_url), status_code=301)

        response = await call_next(request)

        # Item #18: Standard Web Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';"
        if settings.FORCE_HTTPS:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        return response

app.add_middleware(SecurityHardeningMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(schedules.router, prefix="/api/v1")
app.include_router(friendships.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"status": "online", "app": "EUE", "security": "hardened-v8"}

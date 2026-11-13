import sys
import os

# Dynamic path resolution: works both locally and on PythonAnywhere Linux filesystem
path = os.path.dirname(os.path.abspath(__file__))
if os.path.exists('/home/eueapp'):
    path = '/home/eueapp/backend'

if path not in sys.path:
    sys.path.insert(0, path)

# Environment Variables (Loaded from environment / .env in production)
os.environ.setdefault('SMTP_HOST', os.getenv('SMTP_HOST', 'smtp.gmail.com'))
os.environ.setdefault('SMTP_PORT', os.getenv('SMTP_PORT', '587'))
os.environ.setdefault('SMTP_USER', os.getenv('SMTP_USER', ''))
os.environ.setdefault('SMTP_PASSWORD', os.getenv('SMTP_PASSWORD', ''))
os.environ.setdefault('SMTP_FROM_NAME', os.getenv('SMTP_FROM_NAME', 'EUE Schedule Sync'))
os.environ.setdefault('DEBUG', os.getenv('DEBUG', 'False'))
os.environ.setdefault('FORCE_HTTPS', os.getenv('FORCE_HTTPS', 'True'))
db_file = os.path.join(path, 'eue_schedule.db').replace('\\', '/')
os.environ['DATABASE_URL'] = f"sqlite:///{db_file}"

from a2wsgi import ASGIMiddleware
from app.main import app as fastapi_app

application = ASGIMiddleware(fastapi_app)

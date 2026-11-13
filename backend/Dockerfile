FROM python:3.11-slim

# Set up user according to Hugging Face Spaces requirements
RUN useradd -m -u 1000 user

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app
COPY app/ ./app/
COPY rls_and_roles.sql .

# Ensure app directory is fully owned and writable for SQLite WAL mode
RUN chown -R user:user /app && chmod -R 777 /app

USER user

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]

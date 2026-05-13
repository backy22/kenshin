FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including PostgreSQL development files
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-server-dev-all \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "PyJWT>=2.8.0,<3" \
    && python -c "import jwt; assert callable(jwt.encode)"

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 
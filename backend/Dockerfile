FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user; receipts, fines and uploads live in /app/data (mount a volume there)
RUN useradd --create-home tpms && mkdir -p /app/data && chown -R tpms /app
USER tpms
ENV DATA_DIR=/app/data

EXPOSE 8000

# Apply database migrations, then start the API
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]

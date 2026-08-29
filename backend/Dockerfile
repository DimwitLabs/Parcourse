FROM python:3.14-slim

# yt-dlp runs YouTube's own JavaScript to sign some URLs, and deno is the
# runtime it reaches for by default.
COPY --from=denoland/deno:bin-2.9.5 /deno /usr/local/bin/deno

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

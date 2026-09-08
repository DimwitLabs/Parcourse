FROM python:3.14-slim

# yt-dlp runs YouTube's own JavaScript to sign some URLs, and deno is the
# runtime it reaches for by default.
COPY --from=denoland/deno:bin-2.9.5 /deno /usr/local/bin/deno

# yt-dlp and pip both want a home to cache in, so the account gets one.
RUN useradd --create-home --uid 10001 parcourse

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=parcourse:parcourse backend/ .

USER parcourse

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

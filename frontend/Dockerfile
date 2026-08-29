FROM node:26-slim

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY shared/ /app/shared/
COPY frontend/ ./

EXPOSE 5173

CMD ["sh", "-c", "npm run build && npm run preview -- --host 0.0.0.0 --port 5173"]

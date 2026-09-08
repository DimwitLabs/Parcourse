FROM node:26-slim AS build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY shared/ /app/shared/
COPY frontend/ ./

RUN npm run build

FROM nginx:alpine

RUN sed -i '/^user /d; s,^pid .*;,pid /tmp/nginx.pid;,' /etc/nginx/nginx.conf \
    && chown -R nginx:nginx /var/cache/nginx /usr/share/nginx/html

COPY frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/docker/entrypoint.sh /entrypoint.sh
COPY --from=build --chown=nginx:nginx /app/frontend/dist /usr/share/nginx/html

USER nginx

EXPOSE 5173

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

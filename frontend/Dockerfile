# syntax=docker/dockerfile:1.7
FROM node:24.20.0-bookworm-slim AS development
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM development AS build
RUN npm run build

FROM nginx:1.30.4-alpine AS production
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

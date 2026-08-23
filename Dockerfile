# Multi-stage build for Species Dashboard
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Python backend
FROM python:3.11-slim

WORKDIR /app

# Install uv for faster Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy backend files
COPY backend/ ./backend/

# Install Python dependencies
WORKDIR /app/backend
RUN uv sync --frozen

# Copy frontend build from previous stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose port (Railway will set $PORT)
EXPOSE ${PORT:-8000}

# Start the FastAPI server using Railway's $PORT variable
CMD uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

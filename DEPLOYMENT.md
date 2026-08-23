# Railway Deployment Guide

## Overview
This guide walks you through deploying the Species Dashboard to Railway using Docker.

## Prerequisites
- Railway account connected to GitHub ✓ (already done)
- Git repository pushed to GitHub

## Deployment Steps

### 1. Push Your Code to GitHub
```bash
git push origin deployment/railway
```

Or merge to your main branch and push that.

### 2. Set Up PostgreSQL on Railway

1. Go to your Railway project dashboard
2. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create a `DATABASE_URL` environment variable

### 3. Configure Environment Variables

In your Railway project settings, add these environment variables:

**Required:**
- `DATABASE_URL` - Auto-generated when you add PostgreSQL database
- `ANTHROPIC_API_KEY` - Your Anthropic API key for AI features
- `IUCN_API_KEY` - Your IUCN Red List API token

**Optional:**
- `PORT` - Auto-set by Railway (defaults to 8000 in Dockerfile)

To add environment variables:
1. Select your service in Railway
2. Go to **"Variables"** tab
3. Click **"+ New Variable"**
4. Add each key-value pair

### 4. Deploy

Railway will automatically:
1. Detect the `Dockerfile`
2. Build the frontend with Node.js (Stage 1)
3. Build the backend with Python (Stage 2)
4. Copy the frontend build into the backend
5. Start the FastAPI server

The build process:
- ✅ Installs Node dependencies
- ✅ Builds React frontend with Vite
- ✅ Installs Python dependencies with `uv`
- ✅ Serves everything from a single FastAPI app

### 5. Verify Deployment

Once deployed, check:
- Health endpoint: `https://your-app.up.railway.app/api/health`
- Should return: `{"status": "ok", "version": "1.0.0"}`

### 6. Enable pgvector Extension

Your app uses PostgreSQL's `vector` extension for embeddings. The app will try to enable it automatically, but if you get errors:

1. Go to Railway dashboard
2. Select your PostgreSQL database
3. Click **"Data"** tab → **"Query"**
4. Run: `CREATE EXTENSION IF NOT EXISTS vector;`

## Architecture

The deployment uses a **single-service architecture**:
- Frontend (React) → Built to static files
- Backend (FastAPI) → Serves API + static frontend files
- Database (PostgreSQL) → Separate Railway service

This approach:
- ✅ Simpler deployment (one service instead of two)
- ✅ No CORS issues
- ✅ Single domain for frontend and backend
- ✅ Lower cost

## Troubleshooting

### Build fails with "npm: not found"
- ✅ **Fixed!** The Dockerfile now handles both Node.js and Python

### Database connection errors (`connection to server at "localhost" ... failed`)

This error means your Railway service can't connect to the database. Follow these steps:

**Step 1: Add PostgreSQL Database**
1. Go to your Railway project dashboard
2. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Wait for the database to provision

**Step 2: Link Database to Your Service**
1. Railway should automatically create a `DATABASE_URL` variable
2. Go to your service's **"Variables"** tab
3. Verify `DATABASE_URL` is present and looks like:
   ```
   postgresql://postgres:password@hostname:port/dbname
   ```
4. If missing, add it manually using the connection string from your PostgreSQL service

**Step 3: Add Other Required Variables**
1. In the **"Variables"** tab, add:
   - `ANTHROPIC_API_KEY` - Your Anthropic API key
   - `IUCN_API_KEY` - Your IUCN Red List API token (optional, but recommended)

**Step 4: Redeploy**
- Railway will automatically redeploy when you save new variables
- Or manually trigger: **"Settings"** → **"Redeploy"**

### Frontend not loading
- Check Railway logs: `railway logs`
- Verify frontend was built: Should see `frontend/dist` in build logs
- Check that `main.py` has the static file serving code

### "DATABASE_URL environment variable is not set"
- This means the environment variable is missing from Railway
- Follow the database connection errors steps above

### Healthcheck keeps failing after fixing environment variables
- Check Railway logs for detailed error messages
- Ensure pgvector extension is enabled (see section below)
- Verify all dependencies installed correctly in the build logs

### Port binding errors
- The Dockerfile uses `${PORT:-8000}` to respect Railway's port
- Railway automatically sets the `PORT` environment variable

## Local Testing with Docker

To test the Docker build locally:

```bash
# Build the image
docker build -t species-dashboard .

# Run with environment variables
docker run -p 8000:8000 \
  -e DATABASE_URL="your_database_url" \
  -e ANTHROPIC_API_KEY="your_key" \
  -e IUCN_API_KEY="your_key" \
  species-dashboard
```

Then visit: http://localhost:8000

## Next Steps

After successful deployment:
1. Set up a custom domain (optional)
2. Configure monitoring/alerts in Railway
3. Review and optimize database indexes
4. Consider adding a CDN for static assets
5. Set up automated backups for PostgreSQL

## Support

Railway Documentation: https://docs.railway.app/

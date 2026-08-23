from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

# Load environment variables
load_dotenv()

from database import create_tables
from services.rag import init_rag
from api import species, chat, analysis


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    create_tables()
    init_rag()
    yield
    # Shutdown (if needed)


# Create FastAPI app
app = FastAPI(
    title="Biodiversity Intelligence API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Include API routers
app.include_router(species.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "1.0.0"}


# Serve static files from React build
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"

try:
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Catch-all route to serve React SPA for client-side routing."""
        # Don't intercept API routes
        if full_path.startswith("api/"):
            return {"error": "Not found"}
        
        # Serve index.html for all other routes
        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"error": "Frontend not found", "detail": "Run 'npm run build' in /frontend"}
except FileNotFoundError:
    print("Warning: Frontend not built — run `npm run build` in /frontend")
except Exception as e:
    print(f"Warning: Could not mount static files - {e}")


print("Biodiversity Intelligence App is running")
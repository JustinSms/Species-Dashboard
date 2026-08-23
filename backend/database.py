import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables from .env file (for local development only)
# In production (Railway), environment variables are provided directly
load_dotenv()

# Get database URL with better error handling
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise ValueError(
        "DATABASE_URL environment variable is not set. "
        "Please configure it in your Railway project settings. "
        "See DEPLOYMENT.md for instructions."
    )

# Create database engine
engine = create_engine(
    database_url,
    pool_pre_ping=True
)

# Create SessionLocal class
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Create Base class for declarative models
Base = declarative_base()


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create database tables and enable vector extension."""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    
    Base.metadata.create_all(bind=engine)

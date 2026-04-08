"""
Database connection management for LLM-Charge FastAPI backend
"""
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config import settings
import logging
import asyncio
from contextlib import asynccontextmanager

logger = logging.getLogger("llm-charge")

# SQLite uses NullPool; pool_size / max_overflow are invalid for this dialect
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)

async_engine = create_async_engine(
    settings.database_url.replace("sqlite:///", "sqlite+aiosqlite:///"),
    connect_args={"check_same_thread": False},
    echo=False,
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False
)

# Create base class for models
Base = declarative_base()

# Connection pool semaphore for concurrent access
connection_semaphore = asyncio.Semaphore(10)


def get_database_session() -> Session:
    """Get database session for dependency injection"""
    return SessionLocal()


def get_db() -> Session:
    """Get database session for FastAPI dependency injection"""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def get_async_database_session() -> AsyncSession:
    """Get async database session"""
    async with connection_semaphore:
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()


@asynccontextmanager
async def database_transaction():
    """Database transaction context manager"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def database_health_check() -> bool:
    """Check database connectivity"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            return True
    except ConnectionError as e:
        logger.error(f"Database connection failed: {e}")
        return False
    except Exception as e:
        logger.error(f"Database health check error: {e}")
        return False


def _ensure_sqlite_parent_dir(url: str) -> None:
    """Create parent directory for file-based SQLite URLs so create_engine can open the file."""
    try:
        u = make_url(url)
    except Exception:
        return
    if not u.drivername.startswith("sqlite"):
        return
    db = u.database
    if not db or db == ":memory:":
        return
    p = Path(db)
    if not p.is_absolute():
        p = Path.cwd() / p
    if p.parent and str(p.parent) not in (".", ""):
        p.parent.mkdir(parents=True, exist_ok=True)


def init_database():
    """Initialize database tables"""
    try:
        _ensure_sqlite_parent_dir(settings.database_url)
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized")
    except ConnectionError as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        raise
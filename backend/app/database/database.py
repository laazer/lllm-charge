"""
Database connection management for LLM-Charge FastAPI backend
"""
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from app.database.models.base import Base as ModelsBase  # shared Base all models register against
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config import settings
import logging
import asyncio
from contextlib import asynccontextmanager

logger = logging.getLogger("llm-charge")

# Create database engine with connection pooling
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # SQLite specific
    pool_size=20,
    max_overflow=30,
    echo=False
)

# Create async engine for async operations (SQLite does not support pool_size/max_overflow)
_async_db_url = settings.database_url.replace('sqlite:///', 'sqlite+aiosqlite:///')
_is_sqlite = 'sqlite' in _async_db_url
async_engine = create_async_engine(
    _async_db_url,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    **({} if _is_sqlite else {"pool_size": 20, "max_overflow": 30}),
    echo=False
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


def init_database():
    """Initialize database tables"""
    try:
        # Import all models so their tables are registered with Base.metadata
        from app.database.models import agents, workflows, flows, metrics  # noqa: F401
        from app.database.models import main  # noqa: F401 — loads Project, Specification, Note
        import app.cron.models  # noqa: F401 — loads CronJob, CronExecution
        import app.database.models.buddies  # noqa: F401 — loads Buddy, BuddyMessage
        import app.database.models.memory  # noqa: F401 — loads MemoryNote, MemoryCheckpoint
        ModelsBase.metadata.create_all(bind=engine)
        logger.info("Database initialized")
    except ConnectionError as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        raise
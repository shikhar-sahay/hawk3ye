"""Database setup with async SQLModel."""

import ssl
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    async_sessionmaker,
    create_async_engine,
)
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from hawkeye.config import settings


def _sanitize_asyncpg_url(url: str) -> tuple[str, dict]:
    """Handle Neon/Supabase pooled URLs for asyncpg.

    Pooled Neon URLs include libpq query params (sslmode, channel_binding)
    that asyncpg.connect() does not accept. SQLAlchemy's asyncpg dialect
    forwards URL query params as connect() kwargs, so we must strip the
    unsupported ones and translate sslmode into a proper SSL context.

    Returns (sanitized_url, connect_args) where sanitized_url has the
    unsupported params removed and connect_args contains ssl config if needed.

    SQLite URLs are returned unchanged.
    """
    if url.startswith("sqlite"):
        return url, {}

    parsed = urlparse(url)
    if not parsed.query:
        return url, {}

    qs = parse_qs(parsed.query, keep_blank_values=True)

    # libpq params that asyncpg does not accept as kwargs
    unsupported = {"sslmode", "channel_binding"}
    # Only intervene if at least one unsupported param is present
    if not (unsupported & set(qs.keys())):
        return url, {}

    connect_args: dict = {}

    # Translate sslmode into an SSL context for asyncpg.
    # libpq sslmode values: disable, allow, prefer, require, verify-ca, verify-full
    # For Neon pooled connections with sslmode=require, we need SSL enabled.
    sslmode_vals = qs.get("sslmode", [])
    if sslmode_vals:
        sslmode = sslmode_vals[0].lower() if sslmode_vals[0] else ""
        if sslmode in ("require", "verify-ca", "verify-full", "prefer", "allow"):
            # create_default_context() gives a verified context; for
            # sslmode=require the strictest interpretation would be
            # check_hostname=False, but we keep verification enabled as
            # the more secure default for production pooled connections.
            ctx = ssl.create_default_context()
            # For sslmode=require, asyncpg's ssl=True equivalent is a
            # default context. We preserve verification.
            connect_args["ssl"] = ctx

    # Remove unsupported params from URL
    filtered_qs = {k: v for k, v in qs.items() if k not in unsupported}
    new_query = urlencode(filtered_qs, doseq=True)
    sanitized = urlunparse(parsed._replace(query=new_query))

    return sanitized, connect_args


class Database:
    """Async database manager."""

    def __init__(self, url: str | None = None, echo: bool | None = None):
        self._url = url or settings.database_url
        self._echo = echo if echo is not None else settings.database_echo
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None

    @property
    def engine(self) -> AsyncEngine:
        if self._engine is None:
            sanitized_url, connect_args = _sanitize_asyncpg_url(self._url)
            kwargs: dict = dict(
                echo=self._echo,
                future=True,
                pool_pre_ping=True,
            )
            if connect_args:
                kwargs["connect_args"] = connect_args
            self._engine = create_async_engine(sanitized_url, **kwargs)
        return self._engine

    @property
    def session_factory(self) -> async_sessionmaker[AsyncSession]:
        if self._session_factory is None:
            self._session_factory = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
            )
        return self._session_factory

    async def create_all(self) -> None:
        """Create all tables."""
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

    async def drop_all(self) -> None:
        """Drop all tables."""
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.drop_all)

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session."""
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def close(self) -> None:
        """Close the engine."""
        if self._engine:
            await self._engine.dispose()
            self._engine = None
            self._session_factory = None


# Global database instance
db = Database()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions."""
    async with db.session() as session:
        yield session

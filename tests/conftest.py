"""Pytest configuration and fixtures for Hawk3ye tests."""

import pytest
from hawkeye.database import db
from hawkeye.models.events import SQLModel


@pytest.fixture(scope="session", autouse=True)
async def create_test_tables():
    """Create all database tables before running tests."""
    await db.create_all()
    yield
    await db.close()
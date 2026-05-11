#!/usr/bin/env python3
"""Test database configuration to ensure tests use a separate database."""

import os
import tempfile
from pathlib import Path

def setup_test_db():
    """Set up test database environment."""
    # Use in-memory database for tests
    os.environ["CHESSQUIZ_DB_URL"] = "sqlite:///:memory:"
    
def setup_test_db_file():
    """Set up test database with file (for debugging)."""
    test_db = Path("test_chessquiz.db")
    os.environ["CHESSQUIZ_DB_URL"] = f"sqlite:///./{test_db}"
    return test_db

def cleanup_test_db():
    """Clean up test database if using file."""
    test_db = Path("test_chessquiz.db")
    if test_db.exists():
        test_db.unlink()
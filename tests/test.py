#!/usr/bin/env python3
"""ChessQuiz test suite. Run from tests/ directory: python test.py"""

import sys
import os
import subprocess

# Add parent directory to path so pytest can find the backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

def main():
    """Run the test suite using pytest."""
    print("Running ChessQuiz tests...")
    print()
    
    # Run pytest with basic output formatting
    result = subprocess.run([
        sys.executable, "-m", "pytest",
        "-v",
        "--tb=short",
        "."
    ], cwd=os.path.dirname(__file__))
    
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())
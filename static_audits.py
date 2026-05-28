#!/usr/bin/env python3
"""
Static audit script for Phase 9 regression testing.
Checks for specific patterns that have caused bugs in the past.
"""

import sys
from pathlib import Path
import re

ROOT = Path(__file__).parent
FRONTEND_JS = ROOT / "frontend" / "js"

def audit_inline_handlers():
    """Check for inline event handlers that should be centralized."""
    print("=== Inline Handler Audit ===")
    patterns = ["onclick=", "onchange=", "oninput=", "onsubmit="]
    violations = []
    
    for pattern in patterns:
        for html_file in (ROOT / "frontend").rglob("*.html"):
            content = html_file.read_text(errors="ignore")
            if pattern in content:
                lines = content.splitlines()
                for i, line in enumerate(lines, 1):
                    if pattern in line:
                        violations.append(f"{html_file.relative_to(ROOT)}:{i}: {line.strip()}")
    
    if violations:
        print("INLINE HANDLERS FOUND:")
        for v in violations:
            print(f"  {v}")
        return False
    else:
        print("✅ No inline handlers found")
        return True

def audit_direct_fetch():
    """Check for direct fetch() calls outside allowed files."""
    print("\n=== Direct Fetch Audit ===")
    allowed_files = {"api-client.js", "sw.js"}
    violations = []
    
    for js_file in FRONTEND_JS.rglob("*.js"):
        if js_file.name in allowed_files or "vendor" in str(js_file):
            continue
            
        content = js_file.read_text(errors="ignore")
        lines = content.splitlines()
        
        for i, line in enumerate(lines):
            if "fetch(" in line and not line.strip().startswith("//"):
                # Check if this is a documented asset fetch (CDN, static assets)
                is_asset_fetch = False
                
                # Look for asset fetch patterns
                if any(pattern in line.lower() for pattern in ["cdn.", ".svg", ".png", ".jpg", "assets/"]):
                    # Check for documentation in surrounding lines
                    start = max(0, i-3)
                    window = "\n".join(lines[start:i+3])
                    if any(keyword in window.lower() for keyword in ["asset", "sprite", "piece", "cdn", "load"]):
                        is_asset_fetch = True
                
                if not is_asset_fetch:
                    violations.append(f"{js_file.relative_to(ROOT)}:{i+1}: {line.strip()}")
    
    if violations:
        print("UNDOCUMENTED API FETCH CALLS FOUND:")
        for v in violations:
            print(f"  {v}")
        return False
    else:
        print("✅ No disallowed fetch() calls found")
        return True

def audit_history_back():
    """Check for direct history.back() usage outside navigation.js."""
    print("\n=== History.back() Audit ===")
    violations = []
    
    for js_file in FRONTEND_JS.rglob("*.js"):
        if js_file.name == "navigation.js":
            continue
            
        content = js_file.read_text(errors="ignore")
        if "history.back" in content:
            lines = content.splitlines()
            for i, line in enumerate(lines, 1):
                if "history.back" in line and not line.strip().startswith("//"):
                    violations.append(f"{js_file.relative_to(ROOT)}:{i}: {line.strip()}")
    
    if violations:
        print("DIRECT history.back() CALLS FOUND:")
        for v in violations:
            print(f"  {v}")
        return False
    else:
        print("✅ No disallowed history.back() calls found")
        return True

def audit_worker_creation():
    """Check for new Worker() usage outside approved engine files."""
    print("\n=== Worker Creation Audit ===")
    allowed_files = {"stockfish-service.js", "practice-engine-service.js", "engine.js"}
    violations = []
    
    for js_file in FRONTEND_JS.rglob("*.js"):
        if js_file.name in allowed_files:
            continue
            
        content = js_file.read_text(errors="ignore")
        if "new Worker" in content:
            lines = content.splitlines()
            for i, line in enumerate(lines, 1):
                if "new Worker" in line and not line.strip().startswith("//"):
                    violations.append(f"{js_file.relative_to(ROOT)}:{i}: {line.strip()}")
    
    if violations:
        print("UNAPPROVED new Worker() CALLS FOUND:")
        for v in violations:
            print(f"  {v}")
        return False
    else:
        print("✅ Worker creation properly contained")
        return True

def audit_clipboard_writes():
    """Check for direct clipboard.writeText() outside FenActions."""
    print("\n=== Clipboard Write Audit ===")
    violations = []
    
    for js_file in FRONTEND_JS.rglob("*.js"):
        if js_file.name == "fen-actions.js":
            continue
            
        content = js_file.read_text(errors="ignore")
        if "clipboard.writeText" in content:
            lines = content.splitlines()
            for i, line in enumerate(lines, 1):
                if "clipboard.writeText" in line and not line.strip().startswith("//"):
                    violations.append(f"{js_file.relative_to(ROOT)}:{i}: {line.strip()}")
    
    if violations:
        print("DIRECT clipboard.writeText() CALLS FOUND:")
        for v in violations:
            print(f"  {v}")
        return False
    else:
        print("✅ Clipboard operations properly centralized")
        return True

def audit_inner_html_safety():
    """Check that all innerHTML usages have SAFE_INNER_HTML comments."""
    print("\n=== innerHTML Safety Audit ===")
    violations = []
    
    for js_file in FRONTEND_JS.rglob("*.js"):
        content = js_file.read_text(errors="ignore")
        lines = content.splitlines()
        
        for i, line in enumerate(lines):
            if "innerHTML" in line and not line.strip().startswith("//"):
                # Check if there's a SAFE_INNER_HTML comment in the previous 3 lines
                start = max(0, i-3)
                window = "\n".join(lines[start:i+1])
                if "SAFE_INNER_HTML:" not in window:
                    violations.append(f"{js_file.relative_to(ROOT)}:{i+1}: {line.strip()}")
    
    if violations:
        print("UNCOMMENTED innerHTML USAGES:")
        for v in violations:
            print(f"  {v}")
        return False
    else:
        print("✅ All innerHTML usages properly documented")
        return True

def audit_business_logic_duplication():
    """Check for reappearance of duplicated business logic patterns."""
    print("\n=== Business Logic Duplication Audit ===")
    violations = []
    
    # ECO formatting duplication
    eco_pattern = r'\$\{[^}]*eco[^}]*\}\s*—\s*\$\{[^}]*opening'
    for js_file in FRONTEND_JS.rglob("*.js"):
        if js_file.name == "eco-openings.js":  # Skip the central helper
            continue
        content = js_file.read_text(errors="ignore")
        if re.search(eco_pattern, content):
            violations.append(f"{js_file.relative_to(ROOT)}: Direct ECO formatting pattern found")
    
    # Move count conversion duplication
    for js_file in FRONTEND_JS.rglob("*.js"):
        if js_file.name == "move-count.js":  # Skip the central helper
            continue
        content = js_file.read_text(errors="ignore")
        if re.search(r'Math\.ceil\([^)]*\/\s*2\)', content):
            lines = content.splitlines()
            for i, line in enumerate(lines, 1):
                if re.search(r'Math\.ceil\([^)]*\/\s*2\)', line):
                    violations.append(f"{js_file.relative_to(ROOT)}:{i}: Direct ply-to-move conversion found")
    
    # Category label duplication
    category_patterns = [
        r"tabiya.*['\"]Tabiya['\"]",
        r"tactic.*['\"]Tactic['\"]", 
        r"ending.*['\"]Ending['\"]",
        r"strategy.*['\"]Strategy['\"]"
    ]
    for js_file in FRONTEND_JS.rglob("*.js"):
        if js_file.name in {"state.js", "shared.js"}:  # Skip central definitions
            continue
        content = js_file.read_text(errors="ignore")
        for pattern in category_patterns:
            if re.search(pattern, content):
                violations.append(f"{js_file.relative_to(ROOT)}: Direct category label mapping found")
    
    if violations:
        print("BUSINESS LOGIC DUPLICATION FOUND:")
        for v in violations:
            print(f"  {v}")
        return False
    else:
        print("✅ No business logic duplication detected")
        return True

def main():
    """Run all static audits."""
    print("Phase 9 Static Regression Audits")
    print("=" * 40)
    
    all_passed = True
    
    audits = [
        audit_inline_handlers,
        audit_direct_fetch,
        audit_history_back,
        audit_worker_creation,
        audit_clipboard_writes,
        audit_inner_html_safety,
        audit_business_logic_duplication
    ]
    
    for audit in audits:
        if not audit():
            all_passed = False
    
    print("\n" + "=" * 40)
    if all_passed:
        print("✅ ALL STATIC AUDITS PASSED")
        return 0
    else:
        print("❌ SOME STATIC AUDITS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
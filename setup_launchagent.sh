#!/bin/bash
# Setup Chessdirbek as a macOS background service (Launch Agent)
# Run this once: bash setup_launchagent.sh
#
# After setup:
#   - Chessdirbek starts automatically on login
#   - No terminal window needed
#   - Access at http://localhost:8000
#   - Logs: /tmp/chessdirbek.log
#
# To stop:    launchctl unload ~/Library/LaunchAgents/com.chessdirbek.server.plist
# To start:   launchctl load ~/Library/LaunchAgents/com.chessdirbek.server.plist
# To restart: launchctl unload ... && launchctl load ...
# To remove:  bash setup_launchagent.sh uninstall

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.chessdirbek.server"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

# Uninstall mode
if [ "$1" = "uninstall" ]; then
    echo "Removing Chessdirbek Launch Agent..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "✓ Removed. Chessdirbek will no longer start on login."
    exit 0
fi

# Find the python binary
PYTHON_PATH=$(which python3 || which python)
if [ -z "$PYTHON_PATH" ]; then
    echo "Error: python3 not found in PATH"
    exit 1
fi

echo "Setting up Chessdirbek Launch Agent..."
echo "  Project: $SCRIPT_DIR"
echo "  Python:  $PYTHON_PATH"
echo "  Plist:   $PLIST_PATH"
echo ""

# Create the plist
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${PYTHON_PATH}</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>backend.main:app</string>
        <string>--reload</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8000</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/tmp/chessdirbek.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/chessdirbek.log</string>
</dict>
</plist>
PLIST

# Load it
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✓ Chessdirbek Launch Agent installed and started!"
echo ""
echo "  Server:    http://localhost:8000"
echo "  Logs:      tail -f /tmp/chessdirbek.log"
echo "  Stop:      launchctl unload $PLIST_PATH"
echo "  Start:     launchctl load $PLIST_PATH"
echo "  Uninstall: bash setup_launchagent.sh uninstall"
echo ""
echo "Next step: Open Chrome, go to http://localhost:8000,"
echo "click ⋮ menu → 'Install Chessdirbek...' to add it to your Dock."

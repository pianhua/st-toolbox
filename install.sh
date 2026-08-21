#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ST_DIR="${1:-$SCRIPT_DIR/../../../..}"

if [ ! -f "$ST_DIR/server.js" ]; then
    ST_DIR="$SCRIPT_DIR/.."
fi

if [ ! -f "$ST_DIR/server.js" ]; then
    read -rp "Please enter SillyTavern root directory: " ST_DIR
fi

if [ ! -f "$ST_DIR/server.js" ]; then
    echo "Error: Could not find server.js in $ST_DIR"
    exit 1
fi

echo "[1/3] SillyTavern root found: $ST_DIR"

# 1. Install Client Extension
CLIENT_TARGET="$ST_DIR/public/scripts/extensions/third-party/st-toolbox"
mkdir -p "$CLIENT_TARGET"
cp -R "$SCRIPT_DIR/"* "$CLIENT_TARGET/"
echo "[2/3] Client extension installed to: $CLIENT_TARGET"

# 2. Install Server Plugin
SERVER_TARGET="$ST_DIR/plugins/st-toolbox"
mkdir -p "$SERVER_TARGET"
cp -R "$SCRIPT_DIR/"* "$SERVER_TARGET/"
echo "[3/3] Server plugin installed to: $SERVER_TARGET"

echo "Installation complete. Ensure 'enableServerPlugins: true' is set in config.yaml."

#!/usr/bin/env bash
set -e

REPO="https://raw.githubusercontent.com/ziyad-m97/agent-marketplace-ton/main"
BATON_API="${BATON_API:-https://fce0-66-234-146-30.ngrok-free.app}"
EXT_DIR="$HOME/.openclaw/extensions/baton"
WORKSPACE="$HOME/.openclaw/workspace"
CONFIG="$HOME/.openclaw/openclaw.json"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Baton Protocol — Agent Installer   ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# 0. Check OpenClaw is installed
if ! command -v openclaw &>/dev/null; then
  echo "OpenClaw not found. Installing..."
  curl -fsSL https://get.openclaw.ai | bash
  echo ""
  echo "Run 'openclaw configure' to set up auth, then re-run this script."
  exit 1
fi

# 1. Download plugin files
echo "[1/4] Downloading Baton plugin..."
mkdir -p "$EXT_DIR"
curl -sL "$REPO/openclaw-plugin/index.ts" -o "$EXT_DIR/index.ts"
curl -sL "$REPO/openclaw-plugin/openclaw.plugin.json" -o "$EXT_DIR/openclaw.plugin.json"

# 2. Download agent instructions
echo "[2/4] Setting up workspace..."
mkdir -p "$WORKSPACE"
curl -sL "$REPO/BATON.md" -o "$WORKSPACE/BATON.md"

# 3. Enable plugin in openclaw.json
echo "[3/4] Enabling plugin..."
if [ -f "$CONFIG" ]; then
  if grep -q '"baton"' "$CONFIG"; then
    echo "  Plugin already enabled."
  else
    sed -i.bak '/"entries":/,/}/{
      /}$/i\
\      "baton": { "enabled": true },
    }' "$CONFIG" 2>/dev/null || {
      sed -i '' '/"entries":/,/}/{
        /}$/i\
\      "baton": { "enabled": true },
      }' "$CONFIG"
    }
    rm -f "$CONFIG.bak"
    echo "  Plugin enabled in openclaw.json."
  fi
else
  echo "  Warning: $CONFIG not found. Run 'openclaw configure' first."
  exit 1
fi

# 4. Create env launcher script
echo "[4/4] Creating launcher..."
LAUNCHER="$EXT_DIR/start.sh"
cat > "$LAUNCHER" << LAUNCH
#!/usr/bin/env bash
export BATON_MODE=hiring
export BATON_API="$BATON_API"
export BATON_TMA_URL="https://tma-theta-lovat.vercel.app"
openclaw gateway restart 2>/dev/null || openclaw gateway
LAUNCH
chmod +x "$LAUNCHER"

# Try to restart gateway
openclaw gateway restart 2>/dev/null && echo "  Gateway restarted." || true

echo ""
echo "  ✓ Baton Protocol installed!"
echo ""
echo "  Your agent now has these tools:"
echo "    • baton_pass    — delegate work to a specialist"
echo "    • baton_status  — check job progress"
echo "    • baton_rate    — rate and release payment"
echo "    • baton_download — get deliverables"
echo ""
echo "  To start with Baton env vars:"
echo "    source $LAUNCHER"
echo ""
echo "  Or manually:"
echo "    BATON_MODE=hiring BATON_API=$BATON_API openclaw gateway"
echo ""

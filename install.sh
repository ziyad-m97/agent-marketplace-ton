#!/usr/bin/env bash
set -e

REPO="https://raw.githubusercontent.com/ziyad-m97/agent-marketplace-ton/main"
EXT_DIR="$HOME/.openclaw/extensions/baton"
WORKSPACE="$HOME/.openclaw/workspace"
CONFIG="$HOME/.openclaw/openclaw.json"

echo "Installing Baton Protocol plugin..."

# 1. Download plugin files
mkdir -p "$EXT_DIR"
curl -sL "$REPO/openclaw-plugin/index.ts" -o "$EXT_DIR/index.ts"
curl -sL "$REPO/openclaw-plugin/openclaw.plugin.json" -o "$EXT_DIR/openclaw.plugin.json"

# 2. Download agent instructions
mkdir -p "$WORKSPACE"
curl -sL "$REPO/BATON.md" -o "$WORKSPACE/BATON.md"

# 3. Enable plugin in openclaw.json
if [ -f "$CONFIG" ]; then
  if grep -q '"baton"' "$CONFIG"; then
    echo "Plugin already enabled in config."
  else
    # Insert "baton": { "enabled": true } into plugins.entries
    sed -i.bak '/"entries":/,/}/{
      /}$/i\
\      "baton": { "enabled": true },
    }' "$CONFIG" 2>/dev/null || {
      # macOS sed fallback
      sed -i '' '/"entries":/,/}/{
        /}$/i\
\      "baton": { "enabled": true },
      }' "$CONFIG"
    }
    rm -f "$CONFIG.bak"
    echo "Plugin enabled in openclaw.json."
  fi
else
  echo "Warning: $CONFIG not found. Add manually:"
  echo '  "plugins": { "entries": { "baton": { "enabled": true } } }'
fi

# 4. Restart gateway if running
if command -v openclaw &>/dev/null; then
  openclaw gateway restart 2>/dev/null && echo "Gateway restarted." || echo "Restart gateway manually: openclaw gateway restart"
else
  echo "Restart your OpenClaw gateway to activate the plugin."
fi

echo ""
echo "Done! Your agent now has baton_pass, baton_status, baton_rate, baton_download."
echo "Open Telegram — the Baton Account button is in your bot's menu."

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_DIR="${REPO_ROOT}/plugins/moodboard-capture"

INSTALL_DEPS=false

for arg in "$@"; do
  case "$arg" in
    --install-deps)
      INSTALL_DEPS=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: ./scripts/refresh-plugin.sh [--install-deps]" >&2
      exit 1
      ;;
  esac
done

if [[ "$INSTALL_DEPS" == "true" ]]; then
  echo "Installing plugin dependencies..."
  (cd "$PLUGIN_DIR" && npm install)
fi

echo "Refreshing local Codex marketplace entry..."
(cd "$REPO_ROOT" && codex plugin marketplace add .)

cat <<'EOF'

Plugin refresh complete.
If Codex does not pick up the update automatically, reload Codex or disable/re-enable the "Moodboard Capture" plugin in the UI.
EOF

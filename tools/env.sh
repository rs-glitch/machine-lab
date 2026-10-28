# Shared setup for the headless checks (sourced by the other tools/*.sh scripts).
# Finds Chrome on macOS, Linux or Windows (Git Bash), or uses $CHROME; finds Python; converts paths for Windows Chrome.
if [ -z "$CHROME" ]; then
  for c in "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac*/chrome-headless-shell \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac*/"Google Chrome for Testing.app"/Contents/MacOS/"Google Chrome for Testing" \
           "$(command -v google-chrome 2>/dev/null)" "$(command -v chromium 2>/dev/null)" \
           "/c/Program Files/Google/Chrome/Application/chrome.exe"; do
    if [ -n "$c" ] && [ -x "$c" ]; then CHROME=$c; break; fi
  done
fi
[ -n "$CHROME" ] || { echo "Chrome not found; set CHROME=/path/to/chrome" >&2; exit 1; }
PY=${PYTHON:-$(command -v python3 || command -v python)}
nativepath() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
PORT=${PORT:-8765}

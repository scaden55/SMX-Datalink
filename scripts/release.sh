#!/usr/bin/env bash
# ─── SMX ACARS Release Script ─────────────────────────────────
# Usage:  ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.1.0
#
# This script:
#   1. Bumps version in electron/package.json
#   2. Builds shared → backend → frontend → Electron installer
#   3. Deploys backend to VPS (138.197.127.39)
#   4. Commits, tags, and pushes to GitHub
#   5. Creates a GitHub Release with the installer attached
# ───────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "\n${CYAN}[$1/8]${NC} $2"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗ $1${NC}"; exit 1; }
warn() { echo -e "  ${YELLOW}! $1${NC}"; }

# ── Validate args ──────────────────────────────────────────────

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo -e "${RED}Usage: ./scripts/release.sh <version>${NC}"
  echo "  Example: ./scripts/release.sh 1.1.0"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fail "Version must be semver (e.g. 1.1.0), got: $VERSION"
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VPS_HOST="138.197.127.39"
VPS_USER="root"
VPS_PATH="/opt/sma-acars"
INSTALLER="release/SMX-ACARS-Setup-${VERSION}.exe"

# ── Preflight checks ──────────────────────────────────────────

echo -e "${CYAN}═══ SMX ACARS Release v${VERSION} ═══${NC}"

if ! command -v gh &>/dev/null; then
  fail "gh CLI not found. Install: https://cli.github.com/"
fi

if ! gh auth status &>/dev/null && [[ -z "${GH_TOKEN:-}" ]]; then
  fail "Not authenticated. Run 'gh auth login' or set GH_TOKEN"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  warn "Working tree has uncommitted changes — they will be included in the release commit"
fi

# ── Step 1: Bump version ──────────────────────────────────────

step 1 "Bumping version to ${VERSION}"

# Update root and electron/package.json version
node -e "
  const fs = require('fs');
  for (const f of ['package.json', 'electron/package.json']) {
    const p = JSON.parse(fs.readFileSync(f, 'utf8'));
    p.version = '${VERSION}';
    fs.writeFileSync(f, JSON.stringify(p, null, 2) + '\n');
  }
"
ok "package.json + electron/package.json → ${VERSION}"

# ── Step 2: Build shared types ─────────────────────────────────

step 2 "Building shared types"
cd "$ROOT/shared"
npx tsc || fail "shared type-check failed"
ok "shared compiled"

# ── Step 3: Build backend ──────────────────────────────────────

step 3 "Building backend"
cd "$ROOT"
npm run build:backend || fail "backend build failed"
ok "backend compiled"

# ── Step 4: Build frontend ─────────────────────────────────────

step 4 "Building frontend"
cd "$ROOT/frontend"
npx vite build || fail "frontend build failed"
ok "frontend built"

# ── Step 5: Package Electron installer ─────────────────────────

step 5 "Packaging Electron installer"
cd "$ROOT/electron"
npx tsc || fail "electron type-check failed"
cd "$ROOT/electron"
npx electron-builder --win || fail "electron-builder failed"
ok "Installer: ${INSTALLER}"

# ── Step 6: Deploy backend to VPS ──────────────────────────────

step 6 "Deploying backend to VPS (${VPS_HOST})"

# Upload new dist
scp -r "$ROOT/backend/dist" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/dist-new" || fail "SCP dist failed"

# Create a VPS-specific package.json that strips optionalDependencies
# (node-simconnect is Windows-only and fails to compile on Linux)
cd "$ROOT"
node -e "
  const pkg = JSON.parse(require('fs').readFileSync('./backend/package.json', 'utf8'));
  delete pkg.optionalDependencies;
  delete pkg.devDependencies;
  process.stdout.write(JSON.stringify(pkg, null, 2));
" > "$ROOT/backend/dist/vps-package.json"
scp "$ROOT/backend/dist/vps-package.json" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/package-new.json" || fail "SCP package.json failed"

# Swap and restart (sleep + fuser to ensure port 3001 is released before restart)
ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PATH} && \
  pm2 stop sma-acars && \
  sleep 2 && \
  fuser -k 3001/tcp 2>/dev/null; \
  rm -rf dist && \
  mv dist-new dist && \
  mv package-new.json package.json && \
  npm install --omit=dev --silent && \
  pm2 start sma-acars" || fail "VPS deploy failed"

ok "Backend deployed and restarted"

# Verify health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${VPS_HOST}:3001/api/schedules" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  ok "API health check passed (HTTP 200)"
else
  warn "API returned HTTP ${HTTP_CODE} — check VPS logs"
fi

# ── Step 7: Commit, tag, push ──────────────────────────────────

step 7 "Committing and pushing v${VERSION}"
cd "$ROOT"
git add -A
git commit -m "release: v${VERSION}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || warn "Nothing to commit"
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin main --tags || fail "Git push failed"
ok "Pushed v${VERSION} with tag"

# ── Step 8: Create GitHub Release ──────────────────────────────

step 8 "Creating GitHub Release"
gh release create "v${VERSION}" \
  "$ROOT/$INSTALLER" \
  "$ROOT/release/latest.yml" \
  --repo scaden55/SMX-Datalink \
  --title "SMX ACARS v${VERSION}" \
  --notes "## SMX ACARS v${VERSION}

Download **SMX ACARS Setup ${VERSION}.exe** below and run the installer.
Existing installations will auto-update on next launch.

Requires Windows 10/11 x64." \
  || fail "GitHub release creation failed"
ok "Release published"

# ── Done ───────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══ Release v${VERSION} complete ═══${NC}"
echo -e "  Installer: ${INSTALLER}"
echo -e "  Download:  https://github.com/scaden55/SMX-Datalink/releases/download/v${VERSION}/SMX-ACARS-Setup-${VERSION}.exe"
echo -e "  VPS:       http://${VPS_HOST}:3001"

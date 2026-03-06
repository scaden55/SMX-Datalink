#!/usr/bin/env bash
# ─── SMX ACARS Release Script ─────────────────────────────────
# Usage:  ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.1.0
#
# This script:
#   1. Bumps version in electron/package.json
#   2. Builds shared → backend → frontend → admin → Electron installer
#   3. Deploys backend + admin to VPS (138.197.127.39)
#   4. Commits, tags, and pushes to GitHub
#   5. Creates a GitHub Release with the installer attached
# ───────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "\n${CYAN}[$1/10]${NC} $2"; }
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

# ── Step 5: Build admin ──────────────────────────────────────────

step 5 "Building admin"
cd "$ROOT"
npm run build:admin || fail "Admin build failed"
ok "Admin built"

# ── Step 6: Package Electron installer ─────────────────────────

step 6 "Packaging Electron installer"
cd "$ROOT/electron"
npx tsc || fail "electron type-check failed"
cd "$ROOT/electron"
npx electron-builder --win || fail "electron-builder failed"
ok "Installer: ${INSTALLER}"

# ── Step 7: Deploy backend to VPS ──────────────────────────────

step 7 "Deploying backend to VPS (${VPS_HOST})"

# Upload new dist
scp -r "$ROOT/backend/dist" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/dist-new" || fail "SCP dist failed"

# Upload shared dist (backend imports @acars/shared at runtime)
scp -r "$ROOT/shared/dist" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/shared-dist-new" || fail "SCP shared dist failed"
scp "$ROOT/shared/package.json" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/shared-package-new.json" || fail "SCP shared package.json failed"

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

# Deploy: stop → wait for port free → swap files → start → verify
ssh "${VPS_USER}@${VPS_HOST}" 'bash -s' <<'DEPLOY_EOF' || fail "VPS deploy failed"
set -e
cd /opt/sma-acars

echo "[deploy] Stopping old process..."
pm2 delete sma-acars 2>/dev/null || true

echo "[deploy] Waiting for port 3001 to be free..."
for i in $(seq 1 20); do
  if ! fuser 3001/tcp >/dev/null 2>&1; then
    echo "[deploy] Port 3001 is free (after ${i}s)"
    break
  fi
  if [ "$i" -ge 20 ]; then
    echo "[deploy] ERROR: port 3001 still held after 20s"
    fuser -v 3001/tcp 2>&1 || true
    exit 1
  fi
  fuser -k -9 3001/tcp 2>/dev/null || true
  sleep 1
done

echo "[deploy] Swapping dist..."
rm -rf dist
mv dist-new dist
mv package-new.json package.json

echo "[deploy] Updating @acars/shared..."
SHARED_DIR="node_modules/@acars/shared"
mkdir -p "$SHARED_DIR"
rm -rf "$SHARED_DIR/dist"
mv shared-dist-new "$SHARED_DIR/dist"
mv shared-package-new.json "$SHARED_DIR/package.json"

npm install --omit=dev --silent

echo "[deploy] Starting new process..."
pm2 start dist/index.js --name sma-acars --cwd /opt/sma-acars --kill-timeout 5000
pm2 save

echo "[deploy] Waiting for server to be ready..."
for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/stats 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    echo "[deploy] Server healthy (HTTP 200 after ${i}s)"
    exit 0
  fi
  sleep 1
done
echo "[deploy] WARNING: server not healthy after 15s (HTTP $CODE)"
pm2 logs sma-acars --lines 10 --nostream 2>&1 || true
DEPLOY_EOF

ok "Backend deployed and restarted"

# ── Step 8: Deploy admin to VPS ──────────────────────────────────

step 8 "Deploying admin to VPS (${VPS_HOST})"
scp -r "$ROOT/admin/dist/" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/admin-dist-new" || fail "SCP admin dist failed"
ssh "${VPS_USER}@${VPS_HOST}" "rm -rf ${VPS_PATH}/admin-dist && mv ${VPS_PATH}/admin-dist-new ${VPS_PATH}/admin-dist"
ok "Admin frontend deployed"

# ── Step 9: Commit, tag, push ──────────────────────────────────

step 9 "Committing and pushing v${VERSION}"
cd "$ROOT"
git add package.json electron/package.json
git commit -m "release: v${VERSION}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || warn "Nothing to commit"
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin main --tags || fail "Git push failed"
ok "Pushed v${VERSION} with tag"

# ── Step 10: Create GitHub Release ─────────────────────────────

step 10 "Creating GitHub Release"
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

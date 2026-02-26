/**
 * Prepare a standalone backend bundle for Electron packaging.
 *
 * npm workspaces hoist all dependencies to the root node_modules/,
 * leaving backend/node_modules nearly empty (3 entries vs 597 at root).
 * This script creates a self-contained backend directory with:
 *   1. All compiled backend JS + SQL migration files
 *   2. All production dependencies installed locally
 *   3. Native modules (better-sqlite3) rebuilt for Electron's Node.js ABI
 *
 * Run via: npm run prepare:backend
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGING = path.join(ROOT, '.backend-standalone');
const BACKEND_DIST = path.join(ROOT, 'backend', 'dist');
const BACKEND_PKG_PATH = path.join(ROOT, 'backend', 'package.json');
const SHARED_DIR = path.join(ROOT, 'shared');
const ELECTRON_PKG_PATH = path.join(ROOT, 'electron', 'package.json');

// Read Electron version for native module rebuild
const electronPkg = JSON.parse(fs.readFileSync(ELECTRON_PKG_PATH, 'utf-8'));
const electronVersion = electronPkg.devDependencies.electron;

console.log(`[prepare-backend] Electron version: ${electronVersion}`);
console.log(`[prepare-backend] Staging: ${STAGING}`);

// ── Step 1: Clean staging directory ───────────────────────────────
console.log('[prepare-backend] Cleaning staging directory...');
if (fs.existsSync(STAGING)) {
  fs.rmSync(STAGING, { recursive: true, force: true });
}
fs.mkdirSync(STAGING, { recursive: true });

// ── Step 2: Copy compiled backend output ──────────────────────────
// backend/dist/ contains compiled JS + SQL migrations (via copyfiles)
console.log('[prepare-backend] Copying backend/dist → staging...');
fs.cpSync(BACKEND_DIST, STAGING, { recursive: true });

// ── Step 3: Create standalone package.json ────────────────────────
// Remove workspace-only deps and devDependencies so npm install
// only pulls production dependencies into this isolated directory.
const backendPkg = JSON.parse(fs.readFileSync(BACKEND_PKG_PATH, 'utf-8'));
const standalonePkg = {
  name: backendPkg.name,
  version: backendPkg.version,
  private: true,
  type: backendPkg.type, // "module" — required for ESM imports
  dependencies: { ...backendPkg.dependencies },
};

// Carry over optionalDependencies (node-simconnect) so it's available
// in the Electron exe for SimConnect communication with MSFS.
if (backendPkg.optionalDependencies) {
  standalonePkg.optionalDependencies = { ...backendPkg.optionalDependencies };
}

// Remove workspace reference — we install @acars/shared manually
delete standalonePkg.dependencies['@acars/shared'];

fs.writeFileSync(
  path.join(STAGING, 'package.json'),
  JSON.stringify(standalonePkg, null, 2),
);

// ── Step 4: Install production dependencies ───────────────────────
// Running outside the workspace context ensures deps land in staging/node_modules
console.log('[prepare-backend] Installing production dependencies...');
execSync('npm install --omit=dev', {
  cwd: STAGING,
  stdio: 'inherit',
});

// ── Step 5: Copy @acars/shared into node_modules ──────────────────
// Manually place the shared package so the backend can resolve it.
console.log('[prepare-backend] Installing @acars/shared...');
const sharedDest = path.join(STAGING, 'node_modules', '@acars', 'shared');
fs.mkdirSync(sharedDest, { recursive: true });
fs.cpSync(
  path.join(SHARED_DIR, 'dist'),
  path.join(sharedDest, 'dist'),
  { recursive: true },
);
fs.copyFileSync(
  path.join(SHARED_DIR, 'package.json'),
  path.join(sharedDest, 'package.json'),
);

// ── Step 6: Rebuild native modules for Electron ───────────────────
// better-sqlite3 uses raw Node C++ API (not N-API), so the binary
// compiled for system Node v24 (ABI 137) won't work with Electron 33's
// embedded Node v20 (ABI 115). Rebuild it targeting Electron.
console.log(`[prepare-backend] Rebuilding native modules for Electron ${electronVersion}...`);
try {
  const rebuildBin = path.join(ROOT, 'node_modules', '.bin', 'electron-rebuild');
  execSync(
    `"${rebuildBin}" --module-dir "${STAGING}" --electron-version ${electronVersion}`,
    { cwd: ROOT, stdio: 'inherit' },
  );
  console.log('[prepare-backend] Native modules rebuilt successfully.');
} catch (err) {
  console.error('[prepare-backend] WARNING: Native module rebuild failed.');
  console.error('[prepare-backend]', err.message);
  console.error('[prepare-backend] The packaged exe may crash when loading better-sqlite3.');
}

console.log('[prepare-backend] ✓ Standalone backend ready.');

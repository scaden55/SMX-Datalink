const { execSync } = require('child_process');
const path = require('path');

/**
 * electron-builder afterPack hook — stamps the custom icon into the packaged .exe.
 *
 * We keep signAndEditExecutable:false because the winCodeSign extraction
 * fails on Windows without admin (macOS symlink issue). This hook gives us
 * icon embedding without needing the signing toolchain.
 */
exports.default = async function afterPack(context) {
  if (process.platform !== 'win32') return;

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');

  console.log(`[afterPack] Stamping icon into ${exeName}...`);

  try {
    const rceditBin = path.join(
      __dirname, '..', '..', 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe'
    );
    execSync(`"${rceditBin}" "${exePath}" --set-icon "${icoPath}"`, { stdio: 'inherit' });
    console.log(`[afterPack] Icon stamped successfully.`);
  } catch (err) {
    console.error(`[afterPack] rcedit failed:`, err.message);
  }
};

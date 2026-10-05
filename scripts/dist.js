// Cross-platform package helper.
// mac: builds .app and installs to /Applications (same as before)
// win/linux: runs electron-builder for the host platform into dist/
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const name = require('../package.json').build.productName;
const platform = process.platform;
const run = (cmd, env = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

// Signing: set CSC_LINK / CSC_KEY_PASSWORD (and for mac notarize: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID)
// When unset, identity discovery is disabled so local builds still succeed.
const signingEnv = process.env.CSC_LINK || process.env.CSC_NAME
  ? {}
  : { CSC_IDENTITY_AUTO_DISCOVERY: 'false' };

try {
  if (platform === 'darwin') {
    console.log('› Building macOS app…');
    run('npx electron-builder --mac --dir', signingEnv);
    const outDir = fs.readdirSync(dist).find((d) => d.startsWith('mac') && fs.existsSync(path.join(dist, d, `${name}.app`)));
    if (!outDir) throw new Error(`Built ${name}.app not found in dist/`);
    const built = path.join(dist, outDir, `${name}.app`);
    const target = `/Applications/${name}.app`;
    console.log(`› Installing to ${target}`);
    try { execSync(`osascript -e 'tell application "${name}" to quit'`, { stdio: 'ignore' }); } catch { /* not running */ }
    fs.rmSync(target, { recursive: true, force: true });
    run(`ditto "${built}" "${target}"`);
    try { run(`xattr -dr com.apple.quarantine "${target}"`); } catch { /* nothing to clear */ }
    console.log('› Cleaning up dist/');
    fs.rmSync(dist, { recursive: true, force: true });
    console.log(`✔ ${name} installed at ${target}`);
  } else if (platform === 'win32') {
    console.log('› Building Windows installer…');
    run('npx electron-builder --win', signingEnv);
    console.log(`✔ Windows build ready in ${dist}`);
  } else if (platform === 'linux') {
    console.log('› Building Linux packages…');
    run('npx electron-builder --linux', signingEnv);
    console.log(`✔ Linux build ready in ${dist}`);
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exitCode = 1;
}

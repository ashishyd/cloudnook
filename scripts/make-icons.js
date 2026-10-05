// Renders assets/icon.svg to icon.png (1024) + icon.icns (macOS). Run: npm run icons
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assets = path.join(__dirname, '..', 'assets');

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(assets, 'icon.svg'), 'utf8');
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, useContentSize: true });
  await win.loadURL('data:text/html,' + encodeURIComponent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg style="display:block" ')}</body></html>`));
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  const png = path.join(assets, 'icon.png');
  fs.writeFileSync(png, img.toPNG());

  if (process.platform === 'darwin') {
    const set = path.join(assets, 'icon.iconset');
    fs.rmSync(set, { recursive: true, force: true });
    fs.mkdirSync(set);
    for (const s of [16, 32, 64, 128, 256, 512, 1024]) {
      execSync(`sips -z ${s} ${s} "${png}" --out "${set}/tmp_${s}.png"`, { stdio: 'ignore' });
    }
    const map = { 'icon_16x16.png': 16, 'icon_16x16@2x.png': 32, 'icon_32x32.png': 32, 'icon_32x32@2x.png': 64,
      'icon_128x128.png': 128, 'icon_128x128@2x.png': 256, 'icon_256x256.png': 256, 'icon_256x256@2x.png': 512,
      'icon_512x512.png': 512, 'icon_512x512@2x.png': 1024 };
    for (const [name, s] of Object.entries(map)) fs.copyFileSync(`${set}/tmp_${s}.png`, `${set}/${name}`);
    for (const s of [16, 32, 64, 128, 256, 512, 1024]) fs.unlinkSync(`${set}/tmp_${s}.png`);
    execSync(`iconutil -c icns "${set}" -o "${path.join(assets, 'icon.icns')}"`);
    fs.rmSync(set, { recursive: true, force: true });
  }
  console.log('icons written to', assets);
  app.quit();
});

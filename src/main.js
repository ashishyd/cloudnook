const {
  app, screen, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, net, dialog,
  globalShortcut, shell, nativeTheme,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { processDueItems, snoozeMs } = require('./shared/schedule.cjs');
const storeFile = require('./shared/store-file.cjs');
const { taskToEvent, reminderToEvent, wrapCalendar } = require('./shared/ics.cjs');

const isMac = process.platform === 'darwin';
if (process.env.CN_USERDATA) app.setPath('userData', process.env.CN_USERDATA);
if (!process.env.CN_USERDATA && !app.requestSingleInstanceLock()) app.quit();

const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
const INDEX = path.join(__dirname, 'renderer', 'index.html');
const PRELOAD = path.join(__dirname, 'preload.js');
const WIDGET_SIZES = {
  summary: [190, 190], now: [440, 300], hourly: [620, 420], daily: [420, 560],
  details: [400, 520], radar: [560, 480], tasks: [380, 500], reminders: [380, 500], notes: [420, 460],
};
const WIDGET_LABELS = [
  ['summary', 'Weather summary'], ['tasks', 'Tasks'], ['reminders', 'Reminders'], ['notes', 'Sticky notes'],
  ['now', 'Weather — large'], ['hourly', 'Weather — hourly'], ['daily', 'Weather — 14 days'],
  ['details', 'Weather — conditions'], ['radar', 'Weather — radar'],
];
const BACKUP_KEYS = [
  'settings', 'location', 'savedLocations', 'layout', 'tasks', 'reminders', 'notes', 'openWidgets', 'widgetBounds',
  'dismissedAlerts', 'taskLists', 'activeTaskList',
];
const HOTKEY = 'CommandOrControl+Shift+Space';

let state = {};
let stateFile;
let win = null;
let tray = null;
let quitting = false;
let autoUpdater = null;
const widgetWins = new Map();
const notifiedAlerts = new Set();
let updateState = { status: 'idle' };

function loadState() {
  try { state = storeFile.readState(stateFile); }
  catch { state = {}; }
}

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { storeFile.writeState(stateFile, state, { encrypt: true }); }
    catch { fs.writeFile(stateFile, JSON.stringify(state), () => {}); }
  }, 200);
}

function allWindows() {
  return [win, ...widgetWins.values()].filter((w) => w && !w.isDestroyed());
}

function broadcast(key, value, exceptId) {
  for (const w of allWindows()) {
    if (w.webContents.id !== exceptId) w.webContents.send('store:changed', { key, value });
  }
}

function broadcastAll() {
  for (const key of Object.keys(state)) broadcast(key, state[key]);
}

function applyLoginItem() {
  app.setLoginItemSettings({ openAtLogin: !!state.settings?.launchAtLogin });
}

function showMain() {
  if (!win) return createMain();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toggleMain() {
  if (!win || win.isDestroyed()) return createMain();
  if (win.isVisible() && win.isFocused()) win.hide();
  else showMain();
}

function webPrefs() {
  return { preload: PRELOAD, contextIsolation: true, sandbox: true };
}

function createMain() {
  win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 920, minHeight: 640,
    show: false, backgroundColor: '#0b1026', title: 'Cloudnook', icon: ICON,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 20 },
    autoHideMenuBar: !isMac,
    webPreferences: webPrefs(),
  });
  win.loadFile(INDEX);
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });

  if (process.env.CN_SHOT) {
    win.webContents.once('did-finish-load', () => {
      if (process.env.CN_ZOOM) win.webContents.setZoomFactor(Number(process.env.CN_ZOOM));
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(process.env.CN_SHOT, img.toPNG());
        quitting = true;
        app.quit();
      }, Number(process.env.CN_SHOT_DELAY || 5000));
    });
  }
}

function freeSpot(width, height) {
  const wa = screen.getPrimaryDisplay().workArea;
  const taken = [...widgetWins.values()].filter((w) => !w.isDestroyed()).map((w) => w.getBounds());
  const hit = (x, y) => taken.some((b) => x < b.x + b.width + 12 && x + width + 12 > b.x && y < b.y + b.height + 12 && y + height + 12 > b.y);
  for (let x = wa.x + wa.width - width - 16; x >= wa.x + 16; x -= 24) {
    for (let y = wa.y + 16; y + height <= wa.y + wa.height - 8; y += 24) if (!hit(x, y)) return { x, y };
  }
  return { x: wa.x + 80, y: wa.y + 90 };
}

function visibleOnScreen(b) {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x + 40 < a.x + a.width && b.x + b.width - 40 > a.x && b.y + 20 < a.y + a.height && b.y > a.y - 10;
  });
}

function openWidget(name) {
  if (widgetWins.has(name)) { widgetWins.get(name).focus(); return; }
  let [width, height] = WIDGET_SIZES[name] || [380, 460];
  const saved = state.widgetBounds?.[name];
  let pos;
  if (saved && visibleOnScreen(saved)) {
    pos = { x: saved.x, y: saved.y };
    if (name !== 'summary') { width = saved.width; height = saved.height; }
  } else pos = freeSpot(width, height);
  const w = new BrowserWindow({
    width, height, x: pos.x, y: pos.y,
    minWidth: name === 'summary' ? 150 : 260, minHeight: name === 'summary' ? 150 : 180, resizable: name !== 'summary',
    frame: false, transparent: true, hasShadow: true, alwaysOnTop: false,
    skipTaskbar: true, show: false, title: `Cloudnook · ${name}`,
    webPreferences: webPrefs(),
  });
  w.loadFile(INDEX, { query: { widget: name } });
  widgetWins.set(name, w);
  w.setVisibleOnAllWorkspaces(true);
  w.once('ready-to-show', () => w.showInactive());
  const saveBounds = () => {
    if (w.isDestroyed()) return;
    state.widgetBounds = { ...(state.widgetBounds || {}), [name]: w.getBounds() };
    persist();
  };
  w.on('moved', saveBounds);
  w.on('resized', saveBounds);
  w.on('closed', () => {
    widgetWins.delete(name);
    buildTray();
    if (!quitting) {
      state.openWidgets = (state.openWidgets || []).filter((n) => n !== name);
      persist();
      broadcast('openWidgets', state.openWidgets);
    }
  });
  state.openWidgets = [...new Set([...(state.openWidgets || []), name])];
  buildTray();
  persist();
  broadcast('openWidgets', state.openWidgets);
}

function toggleWidget(name) {
  const w = widgetWins.get(name);
  if (w) w.close(); else openWidget(name);
}

function notifyEvent(evt) {
  if (!Notification.isSupported()) return;
  const isTask = evt.kind === 'task';
  const title = isTask ? 'Cloudnook task due' : 'Cloudnook reminder';
  const body = evt.item.title;
  const opts = { title, body, icon: ICON };
  if (isMac) {
    opts.actions = [
      { type: 'button', text: 'Snooze' },
      { type: 'button', text: isTask ? 'Complete' : 'Done' },
    ];
  }
  const n = new Notification(opts);
  n.on('click', showMain);
  n.on('action', (_e, index) => {
    if (index === 0) snoozeItem(evt);
    else if (index === 1) completeItem(evt);
  });
  n.show();
  for (const w of allWindows()) w.webContents.send(isTask ? 'task:due' : 'reminder:fired', evt.item);
}

function snoozeItem(evt) {
  const mins = state.settings?.snoozeMinutes || 10;
  const ms = snoozeMs(mins);
  if (evt.kind === 'reminder') {
    const list = state.reminders || [];
    const r = list.find((x) => x.id === evt.item.id);
    if (!r) return;
    r.due = Date.now() + ms;
    r.fired = false;
    r.done = false;
    persist();
    broadcast('reminders', list);
  } else {
    // Tasks are date-based — snooze by pushing due to tomorrow.
    const list = state.tasks || [];
    const t = list.find((x) => x.id === evt.item.id);
    if (!t) return;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    t.due = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    t.notifiedOn = null;
    persist();
    broadcast('tasks', list);
  }
}

function completeItem(evt) {
  if (evt.kind === 'reminder') {
    const list = state.reminders || [];
    const r = list.find((x) => x.id === evt.item.id);
    if (!r) return;
    r.done = true;
    persist();
    broadcast('reminders', list);
  } else {
    const list = state.tasks || [];
    const t = list.find((x) => x.id === evt.item.id);
    if (!t) return;
    t.done = true;
    persist();
    broadcast('tasks', list);
  }
}

function checkDue() {
  const { changed, events } = processDueItems(state);
  for (const evt of events) notifyEvent(evt);
  if (changed) {
    persist();
    if (events.some((e) => e.kind === 'reminder')) broadcast('reminders', state.reminders);
    if (events.some((e) => e.kind === 'task')) broadcast('tasks', state.tasks);
  }
}

function buildTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Cloudnook', click: showMain },
    { label: 'Show / Hide', accelerator: 'CmdOrCtrl+Shift+Space', click: toggleMain },
    { type: 'separator' },
    { label: 'Desktop widgets', enabled: false },
    ...WIDGET_LABELS.map(([id, label]) => ({
      label, type: 'checkbox', checked: widgetWins.has(id), click: () => toggleWidget(id),
    })),
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 18, height: 18 });
  tray = new Tray(img);
  tray.setToolTip('Cloudnook — Your day, under one sky.');
  tray.on('click', showMain);
  buildTray();
}

function buildAppMenu() {
  const isWin = process.platform === 'win32';
  const about = {
    label: 'About Cloudnook',
    click: () => {
      dialog.showMessageBox(win || undefined, {
        type: 'info',
        title: 'About Cloudnook',
        message: 'Cloudnook',
        detail: `Your day, under one sky.\nVersion ${app.getVersion()}\n\nWeather by Open-Meteo · Radar by RainViewer\nMade by Kitium AI`,
        buttons: ['OK'],
      });
    },
  };
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        about,
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => win?.webContents.send('app:command', 'settings') },
        { type: 'separator' },
        { label: 'Check for Updates…', click: () => { checkUpdatesFromMenu(); } },
        ...(!isMac ? [{ type: 'separator' }, about, { role: 'quit' }] : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Show / Hide Window', accelerator: HOTKEY.replace('CommandOrControl', 'CmdOrCtrl'), click: toggleMain },
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { label: 'Show Cloudnook', click: showMain },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
        ...(isWin ? [{ role: 'close' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Privacy & data',
          click: () => win?.webContents.send('app:command', 'privacy'),
        },
        {
          label: 'Open-Meteo',
          click: () => shell.openExternal('https://open-meteo.com/'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function broadcastOsTheme() {
  const payload = { dark: nativeTheme.shouldUseDarkColors };
  for (const w of allWindows()) w.webContents.send('theme:os', payload);
}

function runOsascript(script) {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function appleDate(ms) {
  const d = new Date(ms);
  // AppleScript date string
  return d.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

async function writeAndOpenIcs(events, suggestedName) {
  const body = wrapCalendar(events);
  if (!events.filter(Boolean).length) return { ok: false, error: 'Nothing with a due date to export.' };
  const tmp = path.join(app.getPath('temp'), suggestedName || `cloudnook-${Date.now()}.ics`);
  fs.writeFileSync(tmp, body, 'utf8');
  await shell.openPath(tmp);
  return { ok: true, path: tmp };
}

function sendUpdate(payload) {
  updateState = payload;
  for (const w of allWindows()) w.webContents.send('app:update', payload);
}

async function checkUpdatesFromMenu() {
  if (!app.isPackaged || !autoUpdater) {
    sendUpdate({
      status: 'dev',
      version: app.getVersion(),
      message: 'Updates are checked in packaged builds.',
    });
    return;
  }
  try {
    sendUpdate({ status: 'checking', version: app.getVersion() });
    await autoUpdater.checkForUpdates();
  } catch (err) {
    sendUpdate({ status: 'error', version: app.getVersion(), message: err?.message || 'Update check failed' });
  }
}

function setupUpdater() {
  if (!app.isPackaged || process.env.CN_SHOT) {
    updateState = { status: 'dev', version: app.getVersion() };
    return;
  }
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    updateState = { status: 'error', version: app.getVersion(), message: err.message };
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ status: 'checking', version: app.getVersion() }));
  autoUpdater.on('update-available', (info) => sendUpdate({ status: 'available', version: app.getVersion(), latest: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdate({ status: 'current', version: app.getVersion() }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ status: 'downloading', version: app.getVersion(), percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => sendUpdate({ status: 'ready', version: app.getVersion(), latest: info.version }));
  autoUpdater.on('error', (err) => sendUpdate({ status: 'error', version: app.getVersion(), message: err?.message || 'Update check failed' }));
  setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 8000);
}

function isUsLocation(loc) {
  if (!loc) return false;
  const c = String(loc.country || '').toLowerCase();
  return c === 'united states' || c === 'united states of america' || c === 'usa' || c === 'us';
}

async function fetchOfficialAlerts(loc) {
  if (!isUsLocation(loc) || loc.lat == null || loc.lon == null) return [];
  try {
    const url = `https://api.weather.gov/alerts/active?point=${loc.lat},${loc.lon}`;
    const res = await net.fetch(url, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': `Cloudnook/${app.getVersion()} (ai.kitium.cloudnook)`,
      },
    });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.features || []).map((f) => {
      const p = f.properties || {};
      return {
        id: p.id || f.id,
        source: 'nws',
        event: p.event || 'Weather alert',
        headline: p.headline || p.event || 'Weather alert',
        severity: (p.severity || 'Unknown').toLowerCase(),
        urgency: (p.urgency || '').toLowerCase(),
        description: p.description || '',
        instruction: p.instruction || '',
        ends: p.ends || p.expires || null,
      };
    });
  } catch {
    return [];
  }
}

function notifyNewAlerts(alerts) {
  if (!Notification.isSupported()) return;
  for (const a of alerts) {
    if (!a?.id || notifiedAlerts.has(a.id)) continue;
    const sev = a.severity;
    if (sev !== 'extreme' && sev !== 'severe') continue;
    notifiedAlerts.add(a.id);
    const n = new Notification({
      title: a.event || 'Weather alert',
      body: a.headline || a.description?.slice(0, 140) || 'Severe weather nearby',
      icon: ICON,
    });
    n.on('click', showMain);
    n.show();
  }
}

ipcMain.handle('store:getAll', () => state);
ipcMain.on('store:set', (e, key, value) => {
  state[key] = value;
  persist();
  broadcast(key, value, e.sender.id);
  if (key === 'settings') {
    applyLoginItem();
    registerHotkey();
  }
});
ipcMain.handle('widget:open', (_e, name) => openWidget(name));
ipcMain.handle('widget:toggle', (_e, name) => toggleWidget(name));
ipcMain.handle('widget:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.handle('win:pin', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return false;
  w.setAlwaysOnTop(!w.isAlwaysOnTop());
  return w.isAlwaysOnTop();
});
ipcMain.handle('geo:locate', async () => {
  const res = await net.fetch('https://ipwho.is/');
  const j = await res.json();
  if (!j.success) throw new Error(j.message || 'Location lookup failed');
  return { name: j.city, region: j.region || '', country: j.country || '', lat: j.latitude, lon: j.longitude, source: 'ip' };
});
ipcMain.handle('geo:reverse', async (_e, lat, lon) => {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=12`;
  const res = await net.fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': `Cloudnook/${app.getVersion()} (ai.kitium.cloudnook)` },
  });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
  const j = await res.json();
  const a = j.address || {};
  let name = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || 'Current location';
  name = name.replace(/^City of\s+/i, '');
  const region = String(a.state || a.region || '').split('/').pop().trim();
  return {
    name, region, country: a.country || '',
    lat: Number(j.lat) || lat, lon: Number(j.lon) || lon, source: 'gps',
  };
});
ipcMain.handle('app:login', (_e, on) => {
  if (!state.settings) state.settings = {};
  state.settings.launchAtLogin = !!on;
  persist();
  applyLoginItem();
});
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:updateStatus', () => updateState);
ipcMain.handle('app:checkUpdate', async () => {
  await checkUpdatesFromMenu();
  return updateState;
});
ipcMain.handle('app:installUpdate', () => {
  if (!autoUpdater || updateState.status !== 'ready') return false;
  quitting = true;
  autoUpdater.quitAndInstall(false, true);
  return true;
});
ipcMain.handle('app:encryption', () => ({
  available: storeFile.canEncrypt(),
  active: (() => {
    try {
      if (!fs.existsSync(stateFile)) return false;
      return fs.readFileSync(stateFile, 'utf8').startsWith(storeFile.MAGIC);
    } catch { return false; }
  })(),
}));
ipcMain.handle('app:openExternal', (_e, url) => {
  if (typeof url === 'string' && /^https?:/i.test(url)) return shell.openExternal(url);
  return false;
});

ipcMain.handle('backup:export', async () => {
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win || undefined, {
    title: 'Export Cloudnook backup',
    defaultPath: `cloudnook-backup-${stamp}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  const data = {};
  for (const k of BACKUP_KEYS) {
    if (state[k] !== undefined) data[k] = state[k];
  }
  const payload = {
    app: 'cloudnook', format: 1,
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    data,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { ok: true, path: filePath };
});

ipcMain.handle('backup:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
    title: 'Import Cloudnook backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(filePaths[0], 'utf8')); }
  catch { return { ok: false, error: 'That file is not valid JSON.' }; }
  const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data
    : (parsed?.settings || parsed?.tasks ? parsed : null);
  if (!data || typeof data !== 'object') return { ok: false, error: 'That file is not a Cloudnook backup.' };

  for (const w of [...widgetWins.values()]) {
    try { w.close(); } catch { /* ignore */ }
  }

  const next = { ...state };
  for (const k of BACKUP_KEYS) {
    if (data[k] !== undefined) next[k] = data[k];
  }
  if (data.settings && typeof data.settings === 'object') {
    next.settings = { ...(state.settings || {}), ...data.settings };
    if (data.settings.custom) {
      next.settings.custom = { ...(state.settings?.custom || {}), ...data.settings.custom };
    }
  }
  next.weather = null;
  state = next;
  persist();
  applyLoginItem();
  registerHotkey();
  broadcastAll();
  for (const name of state.openWidgets || []) openWidget(name);
  return { ok: true };
});

ipcMain.handle('alerts:official', async (_e, loc) => fetchOfficialAlerts(loc));
ipcMain.handle('alerts:notify', (_e, alerts) => {
  notifyNewAlerts(Array.isArray(alerts) ? alerts : []);
  return true;
});
ipcMain.handle('radar:maps', async () => {
  const res = await net.fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) throw new Error(`Radar unavailable (${res.status})`);
  return res.json();
});
ipcMain.handle('theme:os', () => ({ dark: nativeTheme.shouldUseDarkColors }));
ipcMain.handle('calendar:export', async (_e, payload = {}) => {
  const events = [
    ...(payload.tasks || []).map(taskToEvent),
    ...(payload.reminders || []).map(reminderToEvent),
  ].filter(Boolean);
  if (!events.length) return { ok: false, error: 'Nothing with a due date to export.' };
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win || undefined, {
    title: 'Export Calendar',
    defaultPath: `cloudnook-${stamp}.ics`,
    filters: [{ name: 'iCalendar', extensions: ['ics'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, wrapCalendar(events), 'utf8');
  return { ok: true, path: filePath };
});
ipcMain.handle('calendar:add', async (_e, payload = {}) => {
  try {
    const events = [];
    if (payload.task) events.push(taskToEvent(payload.task));
    if (payload.reminder) events.push(reminderToEvent(payload.reminder));
    return await writeAndOpenIcs(events, `cloudnook-item-${Date.now()}.ics`);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('reminders:add', async (_e, payload = {}) => {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'Reminders integration is available on macOS.' };
  }
  try {
    if (payload.task) {
      const t = payload.task;
      const name = String(t.title || 'Task').replace(/"/g, '\\"');
      let script = `tell application "Reminders" to make new reminder with properties {name:"${name}"`;
      if (t.due) {
        const d = new Date(`${t.due}T09:00:00`);
        script += `, due date:date "${appleDate(d.getTime())}"`;
      }
      if ((t.tags || []).length) {
        const body = `Tags: ${(t.tags || []).join(', ')}`.replace(/"/g, '\\"');
        script += `, body:"${body}"`;
      }
      script += '}';
      await runOsascript(script);
      return { ok: true };
    }
    if (payload.reminder) {
      const r = payload.reminder;
      const name = String(r.title || 'Reminder').replace(/"/g, '\\"');
      let script = `tell application "Reminders" to make new reminder with properties {name:"${name}"`;
      if (r.due) script += `, due date:date "${appleDate(r.due)}"`;
      script += '}';
      await runOsascript(script);
      return { ok: true };
    }
    return { ok: false, error: 'Nothing to add.' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

function registerHotkey() {
  globalShortcut.unregisterAll();
  const accel = state.settings?.globalHotkey || HOTKEY;
  try {
    globalShortcut.register(accel, toggleMain);
  } catch { /* accelerator unsupported on this OS */ }
}

app.on('second-instance', showMain);
app.on('before-quit', () => { quitting = true; globalShortcut.unregisterAll(); });
app.on('activate', showMain);
app.on('window-all-closed', () => {});

app.whenReady().then(() => {
  stateFile = path.join(app.getPath('userData'), 'cloudnook.json');
  loadState();
  applyLoginItem();

  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'geolocation');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'geolocation');

  buildAppMenu();
  createMain();
  if (!process.env.CN_SHOT) {
    createTray();
    (state.openWidgets || []).forEach(openWidget);
    registerHotkey();
  }
  setupUpdater();
  nativeTheme.on('updated', broadcastOsTheme);
  setInterval(checkDue, 10000);
  setTimeout(checkDue, 2500);
});

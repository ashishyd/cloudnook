const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cloudnook', {
  platform: process.platform,
  getAll: () => ipcRenderer.invoke('store:getAll'),
  set: (key, value) => ipcRenderer.send('store:set', key, value),
  onChanged: (cb) => {
    const handler = (_e, d) => cb(d);
    ipcRenderer.on('store:changed', handler);
    return () => ipcRenderer.removeListener('store:changed', handler);
  },
  onReminder: (cb) => {
    const handler = (_e, r) => cb(r);
    ipcRenderer.on('reminder:fired', handler);
    return () => ipcRenderer.removeListener('reminder:fired', handler);
  },
  onTaskDue: (cb) => {
    const handler = (_e, t) => cb(t);
    ipcRenderer.on('task:due', handler);
    return () => ipcRenderer.removeListener('task:due', handler);
  },
  onCommand: (cb) => {
    const handler = (_e, cmd) => cb(cmd);
    ipcRenderer.on('app:command', handler);
    return () => ipcRenderer.removeListener('app:command', handler);
  },
  openWidget: (name) => ipcRenderer.invoke('widget:open', name),
  toggleWidget: (name) => ipcRenderer.invoke('widget:toggle', name),
  closeWindow: () => ipcRenderer.invoke('widget:close'),
  togglePin: () => ipcRenderer.invoke('win:pin'),
  locate: () => ipcRenderer.invoke('geo:locate'),
  reverseGeocode: (lat, lon) => ipcRenderer.invoke('geo:reverse', lat, lon),
  setLogin: (on) => ipcRenderer.invoke('app:login', on),
  version: () => ipcRenderer.invoke('app:version'),
  updateStatus: () => ipcRenderer.invoke('app:updateStatus'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  encryption: () => ipcRenderer.invoke('app:encryption'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  onUpdate: (cb) => {
    const handler = (_e, d) => cb(d);
    ipcRenderer.on('app:update', handler);
    return () => ipcRenderer.removeListener('app:update', handler);
  },
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  officialAlerts: (loc) => ipcRenderer.invoke('alerts:official', loc),
  notifyAlerts: (alerts) => ipcRenderer.invoke('alerts:notify', alerts),
  radarMaps: () => ipcRenderer.invoke('radar:maps'),
  osTheme: () => ipcRenderer.invoke('theme:os'),
  onOsTheme: (cb) => {
    const handler = (_e, d) => cb(d);
    ipcRenderer.on('theme:os', handler);
    return () => ipcRenderer.removeListener('theme:os', handler);
  },
  exportCalendar: (payload) => ipcRenderer.invoke('calendar:export', payload),
  addToCalendar: (payload) => ipcRenderer.invoke('calendar:add', payload),
  addToReminders: (payload) => ipcRenderer.invoke('reminders:add', payload),
});

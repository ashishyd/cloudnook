const api = window.cloudnook;

export const WIDGET_IDS = ['now', 'details', 'hourly', 'daily', 'radar', 'tasks', 'reminders', 'notes'];

export const DEFAULTS = {
  settings: {
    theme: 'system', accent: null,
    custom: { tone: 'dark', bg: ['#101830', '#2a1b5e', '#0b6e6e'], accent: '#ffcf5c' },
    blur: 22, opacity: 0.5, radius: 20, fontScale: 1,
    temp: 'c', wind: 'kmh', precip: 'mm', clock24: false,
    animations: true, launchAtLogin: false,
    snoozeMinutes: 10,
    globalHotkey: 'CommandOrControl+Shift+Space',
    privacyAccepted: false,
  },
  location: null,
  savedLocations: [],
  layout: [
    { id: 'now', size: 8, visible: true },
    { id: 'details', size: 4, visible: true },
    { id: 'hourly', size: 8, visible: true },
    { id: 'radar', size: 4, visible: true },
    { id: 'daily', size: 12, visible: true },
    { id: 'tasks', size: 4, visible: true },
    { id: 'reminders', size: 4, visible: true },
    { id: 'notes', size: 4, visible: true },
  ],
  taskLists: [{ id: 'inbox', name: 'Inbox' }],
  activeTaskList: 'inbox',
  tasks: [], reminders: [], notes: [],
  weather: null,
  openWidgets: [],
  dismissedAlerts: [],
};

let state = structuredClone(DEFAULTS);
const listeners = new Set();

function merge(saved) {
  const s = structuredClone(DEFAULTS);
  for (const k of Object.keys(saved || {})) s[k] = saved[k];
  s.settings = { ...DEFAULTS.settings, ...(saved?.settings || {}) };
  s.settings.custom = { ...DEFAULTS.settings.custom, ...(saved?.settings?.custom || {}) };
  if (!Array.isArray(s.taskLists) || !s.taskLists.length) s.taskLists = structuredClone(DEFAULTS.taskLists);
  if (!s.activeTaskList || !s.taskLists.some((l) => l.id === s.activeTaskList)) {
    s.activeTaskList = s.taskLists[0].id;
  }
  s.tasks = (s.tasks || []).map((t) => {
    const listId = t.listId && s.taskLists.some((l) => l.id === t.listId) ? t.listId : s.taskLists[0].id;
    return {
      ...t,
      listId,
      tags: Array.isArray(t.tags) ? t.tags : [],
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    };
  });
  const have = new Set(s.layout.map((l) => l.id));
  for (const l of DEFAULTS.layout) if (!have.has(l.id)) s.layout.push({ ...l });
  s.layout = s.layout.filter((l) => WIDGET_IDS.includes(l.id));
  return s;
}

const emit = (key, silent) => listeners.forEach((fn) => fn(key, silent));

export async function init() {
  state = merge(await api.getAll());
  api.onChanged(({ key, value }) => {
    state[key] = value;
    emit(key, false);
  });
}

export const get = () => state;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function set(key, value, { silent = false } = {}) {
  state[key] = value;
  api.set(key, value);
  emit(key, silent);
}

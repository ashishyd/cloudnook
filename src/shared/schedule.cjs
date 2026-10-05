'use strict';

function pad(n) {
  return String(n).padStart(2, '0');
}

function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextDue(r) {
  const step = r.repeat === 'weekly' ? 7 * 864e5 : 864e5;
  let due = r.due;
  const now = Date.now();
  do {
    due += step;
    if (r.repeat === 'weekdays') {
      const day = new Date(due).getDay();
      if (day === 0 || day === 6) continue;
    }
  } while (due <= now || (r.repeat === 'weekdays' && [0, 6].includes(new Date(due).getDay())));
  return due;
}

function snoozeMs(minutes) {
  const m = Number(minutes);
  return (Number.isFinite(m) && m > 0 ? m : 10) * 60000;
}

/** Returns { reminders?, tasks?, changed } mutations applied in place. */
function processDueItems(state, now = Date.now()) {
  const events = [];
  let changed = false;
  const today = todayStr(new Date(now));
  const snooze = snoozeMs(state.settings?.snoozeMinutes);

  const reminders = state.reminders;
  if (Array.isArray(reminders)) {
    for (const r of reminders) {
      if (r.done || r.fired || r.due > now) continue;
      changed = true;
      events.push({ kind: 'reminder', item: r, snooze });
      if (r.repeat && r.repeat !== 'none') {
        r.due = nextDue(r);
        r.fired = false;
      } else {
        r.fired = true;
      }
    }
  }

  const tasks = state.tasks;
  if (Array.isArray(tasks)) {
    for (const t of tasks) {
      if (t.done || !t.due || t.due > today) continue;
      if (t.notifiedOn === today) continue;
      t.notifiedOn = today;
      changed = true;
      events.push({ kind: 'task', item: t, snooze });
    }
  }

  return { changed, events, snooze };
}

module.exports = { nextDue, todayStr, snoozeMs, processDueItems };

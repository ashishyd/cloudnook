import * as store from '../store.js';
import { esc, uid, fmtDateTime, toLocalInput } from '../util.js';

const REPEAT = { none: 'Once', daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly' };
const SNOOZE_OPTS = [10, 15, 30, 60];

function quick(kind) {
  const d = new Date();
  if (kind === 'm10') d.setMinutes(d.getMinutes() + 10);
  else if (kind === 'h1') d.setHours(d.getHours() + 1);
  else if (kind === 'eve') { d.setHours(18, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); }
  else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  return d.getTime();
}

function snoozeMinutes() {
  const m = store.get().settings.snoozeMinutes;
  return SNOOZE_OPTS.includes(m) ? m : 10;
}

export default {
  id: 'reminders', title: 'Reminders', keys: ['reminders', 'settings'],
  mount(root) {
    root.innerHTML = `
      <form class="addrow col">
        <input class="txt" placeholder="Remind me to…" maxlength="200" autocomplete="off" aria-label="Reminder title" />
        <div class="row2">
          <input type="datetime-local" class="when" aria-label="Due date and time" />
          <select class="rep" aria-label="Repeat">${Object.entries(REPEAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <button class="btn primary sq" title="Add" aria-label="Add reminder">+</button>
        </div>
        <div class="quick" role="group" aria-label="Quick times">
          <button type="button" data-q="m10">10 min</button><button type="button" data-q="h1">1 hour</button>
          <button type="button" data-q="eve">This evening</button><button type="button" data-q="tom">Tomorrow 9am</button>
        </div>
      </form>
      <ul class="rlist" role="list"></ul>`;
    const form = root.querySelector('form');
    const txt = form.querySelector('.txt');
    const when = form.querySelector('.when');
    const rep = form.querySelector('.rep');
    const list = root.querySelector('.rlist');
    when.value = toLocalInput(quick('h1'));

    const save = (r) => store.set('reminders', r);
    const clock24 = () => store.get().settings.clock24;

    function item(r) {
      const due = !r.done && r.fired;
      const mins = snoozeMinutes();
      return `<li class="rem ${r.done ? 'done' : ''} ${due ? 'due' : ''}" data-id="${r.id}">
        <button class="check" aria-label="Mark done"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></button>
        <div class="rb"><span class="rt">${esc(r.title)}</span>
          <small>${due ? 'Due · ' : ''}${fmtDateTime(r.due, clock24())}${r.repeat !== 'none' ? ` · ${REPEAT[r.repeat]}` : ''}</small></div>
        ${due ? `<button class="snooze" title="Snooze ${mins} minutes">Snooze ${mins}m</button>` : ''}
        <button type="button" class="iconish" data-cal title="Add to Calendar" aria-label="Add to Calendar">Cal</button>
        ${window.cloudnook.platform === 'darwin' ? '<button type="button" class="iconish" data-rem title="Add to Reminders" aria-label="Add to Reminders">Rem</button>' : ''}
        <button class="x" aria-label="Delete">×</button></li>`;
    }

    function draw() {
      const all = store.get().reminders;
      const active = all.filter((r) => !r.done).sort((a, b) => a.due - b.due);
      const done = all.filter((r) => r.done).sort((a, b) => b.due - a.due).slice(0, 5);
      list.innerHTML = active.length || done.length
        ? active.map(item).join('') + (done.length ? `<li class="sep">Completed <button class="link" data-clear>Clear</button></li>${done.map(item).join('')}` : '')
        : '<li class="empty">No reminders. Add one above and Cloudnook will nudge you.</li>';
    }

    form.onsubmit = (e) => {
      e.preventDefault();
      const title = txt.value.trim();
      const due = new Date(when.value).getTime();
      if (!title || Number.isNaN(due)) return;
      save([...store.get().reminders, { id: uid(), title, due, repeat: rep.value, fired: false, done: false }]);
      txt.value = ''; txt.focus();
    };
    form.querySelector('.quick').onclick = (e) => {
      const q = e.target.closest('[data-q]');
      if (q) when.value = toLocalInput(quick(q.dataset.q));
    };
    list.addEventListener('click', async (e) => {
      if (e.target.closest('[data-clear]')) return save(store.get().reminders.filter((r) => !r.done));
      const li = e.target.closest('.rem');
      if (!li) return;
      const all = store.get().reminders;
      const id = li.dataset.id;
      const rem = all.find((r) => r.id === id);
      if (e.target.closest('[data-cal]') && rem) {
        const res = await window.cloudnook.addToCalendar({ reminder: rem });
        window.dispatchEvent(new CustomEvent('cn:toast', {
          detail: { msg: res?.ok ? 'Opened in Calendar.' : (res?.error || 'Could not open Calendar.'), kind: res?.ok ? '' : 'warn' },
        }));
        return;
      }
      if (e.target.closest('[data-rem]') && rem) {
        const res = await window.cloudnook.addToReminders({ reminder: rem });
        window.dispatchEvent(new CustomEvent('cn:toast', {
          detail: { msg: res?.ok ? 'Added to Reminders.' : (res?.error || 'Could not add to Reminders.'), kind: res?.ok ? '' : 'warn' },
        }));
        return;
      }
      if (e.target.closest('.check')) save(all.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
      else if (e.target.closest('.x')) save(all.filter((r) => r.id !== id));
      else if (e.target.closest('.snooze')) {
        const mins = snoozeMinutes();
        save(all.map((r) => (r.id === id ? { ...r, due: Date.now() + mins * 60000, fired: false } : r)));
      }
    });
    return { update: draw };
  },
};

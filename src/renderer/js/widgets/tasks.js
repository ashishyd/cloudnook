import * as store from '../store.js';
import { esc, uid, pad, parseLocal } from '../util.js';

const api = window.cloudnook;
const PRIO = ['Low', 'Medium', 'High'];
let statusFilter = 'all';
let tagFilter = null;
let expanded = new Set();

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function dueChip(t) {
  if (!t.due) return '';
  const td = todayStr();
  const label = t.due === td ? 'Today'
    : parseLocal(t.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const cls = !t.done && t.due < td ? 'over' : t.due === td ? 'today' : '';
  return `<span class="due ${cls}">${label}</span>`;
}

function parseTags(raw) {
  return [...new Set(String(raw || '')
    .split(/[,#]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean))];
}

function allTags(tasks) {
  const set = new Set();
  for (const t of tasks) for (const tag of t.tags || []) set.add(tag);
  return [...set].sort();
}

export default {
  id: 'tasks', title: 'Tasks', keys: ['tasks', 'taskLists', 'activeTaskList'],
  mount(root) {
    root.innerHTML = `
      <div class="ph"><div class="progress"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="rtrack"/><circle cx="18" cy="18" r="15" class="rfill"/></svg><b></b></div>
        <div class="pinfo"><strong></strong><small></small></div>
        <div class="task-tools">
          <button type="button" class="btn" data-export-cal title="Export list to Calendar (.ics)">Export .ics</button>
        </div>
      </div>
      <div class="listbar" role="tablist" aria-label="Task lists"></div>
      <form class="addrow col">
        <div class="row2">
          <input class="txt" placeholder="Add a task…" maxlength="200" autocomplete="off" aria-label="Task title" />
          <button type="button" class="prio" data-p="1" title="Priority">Medium</button>
          <input type="date" class="date" title="Due date" aria-label="Due date" />
          <button class="btn primary sq" title="Add" aria-label="Add task">+</button>
        </div>
        <input class="txt tags-in" placeholder="Tags (comma or #work)" maxlength="120" aria-label="Tags" />
      </form>
      <div class="tagbar" role="toolbar" aria-label="Filter by tag"></div>
      <div class="seg"><button type="button" data-f="all">All</button><button type="button" data-f="active">Active</button><button type="button" data-f="done">Done</button></div>
      <ul class="tlist" role="list"></ul>`;
    const form = root.querySelector('form');
    const txt = form.querySelector('.txt');
    const tagsIn = form.querySelector('.tags-in');
    const prioBtn = form.querySelector('.prio');
    const date = form.querySelector('.date');
    const list = root.querySelector('.tlist');
    const listbar = root.querySelector('.listbar');
    const tagbar = root.querySelector('.tagbar');
    const ring = root.querySelector('.rfill');
    const circ = 2 * Math.PI * 15;
    ring.style.strokeDasharray = circ;

    const save = (tasks) => store.set('tasks', tasks);
    const activeList = () => store.get().activeTaskList || store.get().taskLists[0]?.id;
    const listTasks = () => store.get().tasks.filter((t) => (t.listId || 'inbox') === activeList());

    function drawLists() {
      const lists = store.get().taskLists || [];
      const active = activeList();
      listbar.innerHTML = lists.map((l) =>
        `<button type="button" role="tab" class="listchip ${l.id === active ? 'on' : ''}" data-list="${l.id}" aria-selected="${l.id === active}">${esc(l.name)}</button>`).join('')
        + '<button type="button" class="listchip add" data-add-list title="New list">+</button>';
    }

    function drawTags(tasks) {
      const tags = allTags(tasks);
      tagbar.innerHTML = tags.length
        ? `<button type="button" class="tagchip ${!tagFilter ? 'on' : ''}" data-tag="">All tags</button>`
          + tags.map((t) => `<button type="button" class="tagchip ${tagFilter === t ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')
        : '';
    }

    function item(t) {
      const open = expanded.has(t.id);
      const subs = t.subtasks || [];
      const doneSubs = subs.filter((s) => s.done).length;
      const tagHtml = (t.tags || []).map((tag) => `<button type="button" class="tag" data-tag-jump="${esc(tag)}">#${esc(tag)}</button>`).join('');
      return `<li class="task ${t.done ? 'done' : ''} ${open ? 'open' : ''}" data-id="${t.id}">
        <div class="task-main">
          <button type="button" class="check" aria-label="Toggle done"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></button>
          <button type="button" class="expand" aria-expanded="${open}" aria-label="Subtasks">${open ? '▾' : '▸'}</button>
          <span class="tt p${t.prio}" contenteditable="plaintext-only" spellcheck="false">${esc(t.title)}</span>
          ${dueChip(t)}
          ${subs.length ? `<span class="subcount">${doneSubs}/${subs.length}</span>` : ''}
          <button type="button" class="iconish" data-cal title="Add to Calendar" aria-label="Add to Calendar">Cal</button>
          ${api.platform === 'darwin' ? '<button type="button" class="iconish" data-rem title="Add to Reminders" aria-label="Add to Reminders">Rem</button>' : ''}
          <button type="button" class="x" aria-label="Delete">×</button>
        </div>
        <div class="task-meta">${tagHtml}</div>
        ${open ? `<div class="subs">
          ${subs.map((s) => `<div class="sub ${s.done ? 'done' : ''}" data-sid="${s.id}">
            <button type="button" class="check sm" aria-label="Toggle subtask"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></button>
            <span class="st" contenteditable="plaintext-only" spellcheck="false">${esc(s.title)}</span>
            <button type="button" class="x sm" aria-label="Delete subtask">×</button>
          </div>`).join('')}
          <form class="subadd"><input class="txt" placeholder="Add subtask…" maxlength="160" aria-label="New subtask" /><button class="btn sq" aria-label="Add subtask">+</button></form>
        </div>` : ''}
      </li>`;
    }

    function draw() {
      drawLists();
      const tasks = listTasks();
      drawTags(tasks);
      const scoped = tagFilter ? tasks.filter((t) => (t.tags || []).includes(tagFilter)) : tasks;
      const done = scoped.filter((t) => t.done).length;
      const pct = scoped.length ? done / scoped.length : 0;
      ring.style.strokeDashoffset = circ * (1 - pct);
      root.querySelector('.progress b').textContent = `${Math.round(pct * 100)}%`;
      root.querySelector('.pinfo strong').textContent = scoped.length ? `${done} of ${scoped.length} done` : 'Nothing planned yet';
      root.querySelector('.pinfo small').textContent = scoped.length - done ? `${scoped.length - done} to go` : scoped.length ? 'All clear' : 'Add your first task below';
      root.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.f === statusFilter));

      const shown = scoped
        .filter((t) => statusFilter === 'all' || (statusFilter === 'done' ? t.done : !t.done))
        .sort((a, b) => a.done - b.done || b.prio - a.prio || (a.due || '9').localeCompare(b.due || '9') || a.created - b.created);
      list.innerHTML = shown.length ? shown.map(item).join('')
        : `<li class="empty">${statusFilter === 'done' ? 'Nothing completed yet.' : tagFilter ? 'No tasks with this tag.' : 'No tasks here.'}</li>`;
    }

    prioBtn.onclick = () => {
      const p = (+prioBtn.dataset.p + 1) % 3;
      prioBtn.dataset.p = p; prioBtn.textContent = PRIO[p];
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const title = txt.value.trim();
      if (!title) return;
      save([...store.get().tasks, {
        id: uid(), title, done: false, prio: +prioBtn.dataset.p, due: date.value,
        created: Date.now(), listId: activeList(), tags: parseTags(tagsIn.value), subtasks: [],
      }]);
      txt.value = ''; tagsIn.value = ''; date.value = ''; txt.focus();
    };

    root.querySelector('[data-export-cal]').onclick = async () => {
      const res = await api.exportCalendar({ tasks: listTasks().filter((t) => t.due && !t.done) });
      if (res?.ok) window.dispatchEvent(new CustomEvent('cn:toast', { detail: { msg: 'Calendar file exported.' } }));
      else if (res && !res.canceled) window.dispatchEvent(new CustomEvent('cn:toast', { detail: { msg: res.error || 'Export failed.', kind: 'warn' } }));
    };

    listbar.addEventListener('click', (e) => {
      if (e.target.closest('[data-add-list]')) {
        const name = window.prompt('New list name');
        if (!name?.trim()) return;
        const id = uid();
        store.set('taskLists', [...store.get().taskLists, { id, name: name.trim() }]);
        store.set('activeTaskList', id);
        tagFilter = null;
        return;
      }
      const chip = e.target.closest('[data-list]');
      if (!chip) return;
      store.set('activeTaskList', chip.dataset.list);
      tagFilter = null;
    });

    tagbar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tag]');
      if (!b) return;
      tagFilter = b.dataset.tag || null;
      draw();
    });

    root.querySelector('.seg').onclick = (e) => {
      const b = e.target.closest('[data-f]');
      if (b) { statusFilter = b.dataset.f; draw(); }
    };

    list.addEventListener('click', async (e) => {
      const jump = e.target.closest('[data-tag-jump]');
      if (jump) { tagFilter = jump.dataset.tagJump; draw(); return; }

      const li = e.target.closest('.task');
      if (!li) return;
      const id = li.dataset.id;
      const tasks = store.get().tasks;
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      if (e.target.closest('.expand')) {
        if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
        draw();
        return;
      }
      if (e.target.closest('[data-cal]')) {
        const res = await api.addToCalendar({ task });
        window.dispatchEvent(new CustomEvent('cn:toast', {
          detail: { msg: res?.ok ? 'Opened in Calendar.' : (res?.error || 'Could not open Calendar.'), kind: res?.ok ? '' : 'warn' },
        }));
        return;
      }
      if (e.target.closest('[data-rem]')) {
        const res = await api.addToReminders({ task });
        window.dispatchEvent(new CustomEvent('cn:toast', {
          detail: { msg: res?.ok ? 'Added to Reminders.' : (res?.error || 'Could not add to Reminders.'), kind: res?.ok ? '' : 'warn' },
        }));
        return;
      }

      const sub = e.target.closest('.sub');
      if (sub) {
        const sid = sub.dataset.sid;
        if (e.target.closest('.check')) {
          save(tasks.map((t) => t.id !== id ? t : {
            ...t,
            subtasks: (t.subtasks || []).map((s) => s.id === sid ? { ...s, done: !s.done } : s),
          }));
        } else if (e.target.closest('.x')) {
          save(tasks.map((t) => t.id !== id ? t : {
            ...t, subtasks: (t.subtasks || []).filter((s) => s.id !== sid),
          }));
        }
        return;
      }

      if (e.target.closest('.check') && !e.target.closest('.sub')) {
        save(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
      } else if (e.target.closest('.x') && !e.target.closest('.sub')) {
        save(tasks.filter((t) => t.id !== id));
        expanded.delete(id);
      }
    });

    list.addEventListener('submit', (e) => {
      const formEl = e.target.closest('.subadd');
      if (!formEl) return;
      e.preventDefault();
      const li = formEl.closest('.task');
      const input = formEl.querySelector('input');
      const title = input.value.trim();
      if (!title || !li) return;
      const id = li.dataset.id;
      save(store.get().tasks.map((t) => t.id !== id ? t : {
        ...t,
        subtasks: [...(t.subtasks || []), { id: uid(), title, done: false }],
      }));
      expanded.add(id);
      input.value = '';
    });

    list.addEventListener('focusout', (e) => {
      const li = e.target.closest('.task');
      if (!li) return;
      const id = li.dataset.id;
      if (e.target.classList.contains('tt')) {
        const title = e.target.textContent.trim();
        const tasks = store.get().tasks;
        if (!title) save(tasks.filter((t) => t.id !== id));
        else save(tasks.map((t) => (t.id === id ? { ...t, title } : t)));
      }
      if (e.target.classList.contains('st')) {
        const sid = e.target.closest('.sub')?.dataset.sid;
        const title = e.target.textContent.trim();
        save(store.get().tasks.map((t) => t.id !== id ? t : {
          ...t,
          subtasks: title
            ? (t.subtasks || []).map((s) => s.id === sid ? { ...s, title } : s)
            : (t.subtasks || []).filter((s) => s.id !== sid),
        }));
      }
    });

    list.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target.classList.contains('tt') || e.target.classList.contains('st'))) {
        e.preventDefault(); e.target.blur();
      }
    });

    return { update: draw };
  },
};

import * as store from '../store.js';
import { esc, uid, debounce } from '../util.js';

export const NOTE_COLORS = ['#ffe97a', '#ffb3c7', '#a8f0c6', '#a6d8ff', '#d5c2ff', '#ffc9a0'];
let lastColor = NOTE_COLORS[0];

export default {
  id: 'notes', title: 'Sticky notes', keys: ['notes'],
  mount(root) {
    root.innerHTML = `
      <div class="nhead"><span class="dim">Quick thoughts, always in sight</span>
        <div class="swatches">${NOTE_COLORS.map((c) => `<button data-c="${c}" style="background:${c}" title="New ${c} note"></button>`).join('')}</div></div>
      <div class="ngrid"></div>`;
    const grid = root.querySelector('.ngrid');
    const save = (n, silent) => store.set('notes', n, { silent });
    const saveSoon = debounce(() => save(store.get().notes, true), 300);

    const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; };

    function draw() {
      const notes = [...store.get().notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
      grid.innerHTML = notes.length ? notes.map((n, i) => `
        <div class="note ${n.pinned ? 'pinned' : ''}" data-id="${n.id}" style="--nc:${n.color};--rot:${((i * 37) % 5 - 2) * 0.5}deg">
          <div class="ntools">
            <button data-a="pin" title="${n.pinned ? 'Unpin' : 'Pin'}">${n.pinned ? '★' : '☆'}</button>
            <button data-a="color" title="Change colour">◐</button>
            <button data-a="del" title="Delete">×</button>
          </div>
          <textarea placeholder="Write something…" spellcheck="false">${esc(n.text)}</textarea>
        </div>`).join('') : '<div class="empty">No notes yet — pick a colour above to stick one.</div>';
      grid.querySelectorAll('textarea').forEach(fit);
    }

    root.querySelector('.swatches').onclick = (e) => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      lastColor = b.dataset.c;
      save([...store.get().notes, { id: uid(), text: '', color: lastColor, pinned: false, updated: Date.now() }]);
      grid.querySelector('textarea')?.focus();
      const first = [...grid.querySelectorAll('.note')].find((n) => !n.querySelector('textarea').value);
      first?.querySelector('textarea').focus();
    };
    grid.addEventListener('input', (e) => {
      const ta = e.target;
      if (ta.tagName !== 'TEXTAREA') return;
      fit(ta);
      const id = ta.closest('.note').dataset.id;
      const note = store.get().notes.find((n) => n.id === id);
      if (note) { note.text = ta.value; note.updated = Date.now(); }
      saveSoon();
    });
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-a]');
      if (!btn) return;
      const id = btn.closest('.note').dataset.id;
      const notes = store.get().notes;
      const a = btn.dataset.a;
      if (a === 'del') save(notes.filter((n) => n.id !== id));
      else if (a === 'pin') save(notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
      else if (a === 'color') {
        save(notes.map((n) => (n.id === id ? { ...n, color: NOTE_COLORS[(NOTE_COLORS.indexOf(n.color) + 1) % NOTE_COLORS.length] } : n)));
      }
    });
    return { update: draw };
  },
};

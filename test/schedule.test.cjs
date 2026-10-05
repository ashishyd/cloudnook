'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextDue, todayStr, snoozeMs, processDueItems } = require('../src/shared/schedule.cjs');

test('todayStr formats local date', () => {
  assert.match(todayStr(new Date(2026, 9, 5)), /^2026-10-05$/);
});

test('snoozeMs defaults to 10 minutes', () => {
  assert.equal(snoozeMs(), 10 * 60000);
  assert.equal(snoozeMs(30), 30 * 60000);
});

test('nextDue advances daily past now', () => {
  const now = Date.UTC(2026, 9, 5, 12);
  const r = { due: now - 1000, repeat: 'daily' };
  const due = nextDue(r);
  assert.ok(due > Date.now() - 1000);
});

test('processDueItems fires reminders and tasks once', () => {
  const now = Date.now();
  const today = todayStr(new Date(now));
  const state = {
    settings: { snoozeMinutes: 15 },
    reminders: [
      { id: 'r1', title: 'Call', due: now - 1000, fired: false, done: false, repeat: 'none' },
      { id: 'r2', title: 'Later', due: now + 60000, fired: false, done: false, repeat: 'none' },
    ],
    tasks: [
      { id: 't1', title: 'Pay bills', due: today, done: false },
      { id: 't2', title: 'Future', due: '2099-01-01', done: false },
    ],
  };
  const first = processDueItems(state, now);
  assert.equal(first.changed, true);
  assert.equal(first.events.length, 2);
  assert.equal(first.events[0].kind, 'reminder');
  assert.equal(first.events[1].kind, 'task');
  assert.equal(state.reminders[0].fired, true);
  assert.equal(state.tasks[0].notifiedOn, today);

  const second = processDueItems(state, now);
  assert.equal(second.changed, false);
  assert.equal(second.events.length, 0);
});

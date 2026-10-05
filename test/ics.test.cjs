'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { taskToEvent, reminderToEvent, wrapCalendar } = require('../src/shared/ics.cjs');

test('taskToEvent builds all-day VEVENT', () => {
  const ev = taskToEvent({ id: 't1', title: 'Pay rent', due: '2026-10-05', tags: ['home'], subtasks: [] });
  assert.match(ev, /SUMMARY:Pay rent/);
  assert.match(ev, /DTSTART;VALUE=DATE:20261005/);
  assert.match(ev, /Tags: home/);
});

test('reminderToEvent builds timed VEVENT', () => {
  const due = Date.UTC(2026, 9, 5, 15, 30);
  const ev = reminderToEvent({ id: 'r1', title: 'Call', due, repeat: 'none' });
  assert.match(ev, /SUMMARY:Call/);
  assert.match(ev, /DTSTART:/);
});

test('wrapCalendar wraps events', () => {
  const ics = wrapCalendar([taskToEvent({ id: 't1', title: 'A', due: '2026-10-05' })]);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /END:VCALENDAR/);
});

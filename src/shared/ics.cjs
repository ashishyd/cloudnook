'use strict';

function pad(n) {
  return String(n).padStart(2, '0');
}

function icsDate(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function icsDay(dateStr) {
  // YYYY-MM-DD → all-day VALUE=DATE
  return dateStr.replace(/-/g, '');
}

function escapeIcs(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildEvent({ uid, title, description, start, end, allDay }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}@cloudnook`,
    `DTSTAMP:${icsDate(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function taskToEvent(task) {
  if (!task?.due) return null;
  const start = icsDay(task.due);
  const endDate = new Date(`${task.due}T12:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const end = icsDay(`${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`);
  const tags = (task.tags || []).length ? `Tags: ${(task.tags || []).join(', ')}` : '';
  const subs = (task.subtasks || []).map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('\n');
  return buildEvent({
    uid: task.id,
    title: task.title,
    description: [tags, subs].filter(Boolean).join('\n'),
    start,
    end,
    allDay: true,
  });
}

function reminderToEvent(reminder) {
  if (!reminder?.due) return null;
  const start = new Date(reminder.due);
  const end = new Date(reminder.due + 30 * 60000);
  return buildEvent({
    uid: reminder.id,
    title: reminder.title,
    description: reminder.repeat && reminder.repeat !== 'none' ? `Repeats: ${reminder.repeat}` : '',
    start: icsDate(start),
    end: icsDate(end),
    allDay: false,
  });
}

function wrapCalendar(events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kitium AI//Cloudnook//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.filter(Boolean),
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}

module.exports = { taskToEvent, reminderToEvent, wrapCalendar, escapeIcs };

import now from './now.js';
import details from './details.js';
import hourly from './hourly.js';
import daily from './daily.js';
import radar from './radar.js';
import tasks from './tasks.js';
import reminders from './reminders.js';
import notes from './notes.js';
import summary from './summary.js';

export default Object.fromEntries(
  [now, details, hourly, daily, radar, tasks, reminders, notes, summary].map((w) => [w.id, w]),
);

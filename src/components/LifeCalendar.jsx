import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar, Download, Zap, Clock } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  // Monday-first: 0=Mon ... 6=Sun
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

// Build a full ICS file string from tasks that have an `hour` field
function buildICS(todos) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sergiu OS//Sergiu OS Tasks//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const today = new Date();
  todos.forEach(t => {
    if (!t.hour || t.completed) return;
    // Use today's date for time-slotted tasks (they recur daily until marked done)
    const dtStart = new Date(today);
    dtStart.setHours(t.hour, 0, 0, 0);
    const dtEnd = new Date(dtStart);
    dtEnd.setHours(t.hour + 1, 0, 0, 0);

    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    lines.push(
      'BEGIN:VEVENT',
      `UID:task-${t.id}@sergiu-os`,
      `DTSTART:${fmt(dtStart)}`,
      `DTEND:${fmt(dtEnd)}`,
      `SUMMARY:${t.text.replace(/,/g, '\\,')}`,
      `DESCRIPTION:Project: ${t.projectId || 'General'} | Energy: ${t.energy || 'normal'} | Stage: ${t.stage || 'Idea'}`,
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadICS(todos) {
  const content = buildICS(todos);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sergiu-os-tasks.ics';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LifeCalendar({ todos, onClose }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  // Build a map: "YYYY-MM-DD" → [tasks]
  const tasksByDate = useMemo(() => {
    const map = {};
    todos.forEach(t => {
      if (!t.dueDate) return;
      const key = t.dueDate; // expects "YYYY-MM-DD"
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [todos]);

  // Also build a map for tasks with `hour` — show them on today
  const timedTasksToday = useMemo(() =>
    todos.filter(t => t.hour != null && !t.completed)
  , [todos]);

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const todayTasks = [...(tasksByDate[todayKey] || []), ...timedTasksToday]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i); // dedupe

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isPast = (d) => new Date(viewYear, viewMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const getDayKey = (d) =>
    `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const getDayTasks = (d) => {
    const key = getDayKey(d);
    const dated = tasksByDate[key] || [];
    // Add timed tasks on today
    if (isToday(d)) {
      return [...dated, ...timedTasksToday].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
    }
    return dated;
  };

  const selectedDayTasks = selectedDay ? getDayTasks(selectedDay) : [];

  const energyDot = (tasks) => {
    if (tasks.some(t => t.energy === 'high')) return 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]';
    if (tasks.some(t => t.energy === 'low')) return 'bg-green-400';
    return 'bg-indigo-400';
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#07070e]/97 backdrop-blur-2xl animate-fade-in"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            <Calendar size={17} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-none">Life Calendar</div>
            <div className="text-white/30 text-[10px] mt-0.5">{viewYear}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadICS(todos)}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/8 transition-all"
            title="Export tasks as .ics — import into Apple Calendar, Google Calendar, or any calendar app"
          >
            <Download size={13} />
            Export .ics
          </button>
          <button
            onClick={goToToday}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/25 transition-all"
          >
            Today
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white rounded-xl hover:bg-white/10 transition-all ml-1"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Calendar */}
        <div className="flex-1 flex flex-col overflow-hidden px-4 py-4">

          {/* Month Navigator */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {MONTHS[viewMonth]} <span className="text-white/30 font-normal">{viewYear}</span>
            </h2>
            <button
              onClick={nextMonth}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-widest text-white/25 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 flex-1">
            {cells.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const dayTasks = getDayTasks(d);
              const hasSelected = selectedDay === d;
              const todayFlag = isToday(d);
              const pastFlag = isPast(d);

              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d === selectedDay ? null : d)}
                  className={`
                    relative flex flex-col items-center pt-2 pb-1 rounded-2xl transition-all duration-200 min-h-[52px]
                    ${hasSelected ? 'bg-blue-500/20 border border-blue-500/40' : 'hover:bg-white/5 border border-transparent'}
                    ${todayFlag && !hasSelected ? 'ring-2 ring-blue-500/60 ring-offset-0' : ''}
                  `}
                >
                  <span className={`text-sm font-bold leading-none mb-1.5 ${
                    todayFlag ? 'text-blue-400' :
                    pastFlag ? 'text-white/25' :
                    'text-white/70'
                  }`}>
                    {d}
                  </span>

                  {/* Task dots */}
                  {dayTasks.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 justify-center max-w-full px-1">
                      {dayTasks.slice(0, 3).map((t, idx) => (
                        <div
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            t.energy === 'high' ? 'bg-red-400 shadow-[0_0_4px_rgba(239,68,68,0.8)]' :
                            t.energy === 'low' ? 'bg-green-400' :
                            'bg-indigo-400'
                          }`}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[9px] text-white/30 leading-none">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 pt-4 border-t border-white/5 mt-3">
            <span className="text-white/25 text-[10px] uppercase tracking-wider">Legend</span>
            {[
              { color: 'bg-red-400 shadow-[0_0_4px_rgba(239,68,68,0.8)]', label: 'High energy' },
              { color: 'bg-green-400', label: 'Low energy' },
              { color: 'bg-indigo-400', label: 'Task' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-white/30 text-[10px]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day Detail Panel */}
        <div className={`
          w-[280px] flex-shrink-0 border-l border-white/8 flex flex-col overflow-hidden
          transition-all duration-300
          ${selectedDay || true ? 'opacity-100' : 'opacity-0'}
        `}>
          <div className="px-4 pt-4 pb-3 border-b border-white/8">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">
              {selectedDay ? `${MONTHS[viewMonth]} ${selectedDay}, ${viewYear}` : `Today — ${MONTHS[today.getMonth()]} ${today.getDate()}`}
            </div>
            <div className="text-white font-bold text-lg">
              {selectedDay
                ? isToday(selectedDay) ? 'Today' : new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('en', { weekday: 'long' })
                : new Date().toLocaleDateString('en', { weekday: 'long' })
              }
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {(selectedDay ? selectedDayTasks : todayTasks).length === 0 ? (
              <div className="text-white/25 text-sm text-center pt-8">
                No tasks for this day.
                <br />
                <span className="text-[11px]">Add "ora X" to a task to pin it here.</span>
              </div>
            ) : (
              (selectedDay ? selectedDayTasks : todayTasks)
                .sort((a, b) => (a.hour ?? 99) - (b.hour ?? 99))
                .map(t => (
                  <div
                    key={t.id}
                    className="flex items-start gap-2.5 bg-white/4 border border-white/6 rounded-xl p-3"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                      t.energy === 'high' ? 'bg-red-400 shadow-[0_0_5px_rgba(239,68,68,0.8)]' :
                      t.energy === 'low' ? 'bg-green-400' : 'bg-indigo-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 text-sm font-medium leading-snug truncate">{t.text}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {t.hour != null && (
                          <span className="flex items-center gap-1 text-[10px] text-white/40">
                            <Clock size={9} /> {t.hour}:00
                          </span>
                        )}
                        {t.projectId && (
                          <span className="text-[10px] text-white/30 truncate max-w-[100px]">{t.projectId}</span>
                        )}
                        {t.energy === 'high' && (
                          <span className="flex items-center gap-0.5 text-[10px] text-red-400">
                            <Zap size={9} />High
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* ICS export hint */}
          <div className="px-4 py-3 border-t border-white/5">
            <p className="text-white/20 text-[10px] leading-relaxed">
              Tap <strong className="text-white/30">Export .ics</strong> to sync with Apple Calendar, Google Calendar or Outlook.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, Zap, DollarSign, AlertCircle, LayoutGrid, ChevronRight } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_START = 7;   // 07:00
const DAY_END   = 23;  // 23:00
const HOURS     = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => i + DAY_START);
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const domainColor = (task) => {
  if (task.domain === 'personal') return { bar: 'bg-blue-500',  pill: 'bg-blue-500/20 border-blue-500/30 text-blue-200'  };
  if (task.domain === 'business') return { bar: 'bg-amber-500', pill: 'bg-amber-500/20 border-amber-500/30 text-amber-200' };
  // fallback: derive from projectColor class string or default indigo
  return { bar: 'bg-indigo-500', pill: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200' };
};

const energyGlow = (energy) => {
  if (energy === 'high') return 'shadow-[0_0_10px_rgba(239,68,68,0.4)]';
  if (energy === 'low')  return 'shadow-[0_0_8px_rgba(52,211,153,0.25)]';
  return '';
};

function getWeekDates() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  // Monday-based week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

const KpiPill = ({ label, value, sub, color = 'text-white' }) => (
  <div className="flex flex-col items-center px-4 py-2.5 bg-white/4 rounded-2xl border border-white/6 min-w-[80px]">
    <span className={`text-base font-bold font-mono tabular-nums leading-none ${color}`}>{value}</span>
    {sub && <span className="text-[10px] text-white/30 mt-0.5 font-mono">{sub}</span>}
    <span className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">{label}</span>
  </div>
);

const TaskBlock = ({ task }) => {
  const col = domainColor(task);
  const glow = energyGlow(task.energy);
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${col.pill} ${glow} backdrop-blur-sm`}>
      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${col.bar}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/90 leading-tight truncate">{task.text}</p>
        {task.projectId && (
          <p className="text-[10px] text-white/40 mt-0.5 truncate">{task.projectId}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {task.energy === 'high' && <div className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_5px_rgba(239,68,68,0.8)]" />}
        {task.energy === 'low'  && <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const DashboardView = ({ todos, financial }) => {
  const [now, setNow] = useState(new Date());
  const nowLineRef = useRef(null);

  // Tick every minute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Scroll "now" line into view on mount
  useEffect(() => {
    setTimeout(() => nowLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, []);

  const currentHour   = now.getHours();
  const currentMinute = now.getMinutes();

  // ── Derived data ─────────────────────────────────────────────────────────

  const activeTodos = useMemo(() => todos.filter(t => !t.completed), [todos]);

  const scheduled   = useMemo(() => activeTodos.filter(t => t.hour != null).sort((a, b) => a.hour - b.hour), [activeTodos]);
  const unscheduled = useMemo(() => activeTodos.filter(t => t.hour == null), [activeTodos]);

  const highCount = activeTodos.filter(t => t.energy === 'high').length;
  const lowCount  = activeTodos.filter(t => t.energy === 'low').length;

  // Finance KPIs
  const fin = financial || { clients: [], spotClients: [], accountBalance: 0 };
  const TARGET = 20000;
  const retainerTotal = (fin.clients || []).reduce((s, c) => s + c.amount, 0);
  const spotPaid      = (fin.spotClients || []).filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const collected     = retainerTotal + spotPaid;
  const pct           = Math.min(100, Math.round((collected / TARGET) * 100));
  const revenueColor  = collected >= TARGET ? 'text-emerald-400' : collected >= TARGET * 0.6 ? 'text-amber-400' : 'text-red-400';

  // Week task density
  const weekDates = useMemo(getWeekDates, []);
  const taskCountByDate = useMemo(() => {
    const map = {};
    activeTodos.forEach(t => {
      if (t.dueDate) {
        map[t.dueDate] = (map[t.dueDate] || 0) + 1;
      }
    });
    // Add timed tasks to today
    const todayKey = now.toISOString().slice(0, 10);
    map[todayKey] = (map[todayKey] || 0) + scheduled.length;
    return map;
  }, [activeTodos, scheduled, now]);

  const todayKey = now.toISOString().slice(0, 10);

  // Tasks per hour map
  const tasksByHour = useMemo(() => {
    const map = {};
    scheduled.forEach(t => {
      if (!map[t.hour]) map[t.hour] = [];
      map[t.hour].push(t);
    });
    return map;
  }, [scheduled]);

  // ── "Now" line position within the day ───────────────────────────────────
  // Each hour slot is rendered as a row; "now" line sits at fractional position
  const nowIsInView = currentHour >= DAY_START && currentHour <= DAY_END;
  const nowFraction = (currentHour + currentMinute / 60 - DAY_START) / (DAY_END - DAY_START + 1);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col gap-4 animate-fade-in">

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <KpiPill
          label="Today"
          value={scheduled.length}
          sub={`${unscheduled.length} unscheduled`}
          color="text-white"
        />
        <KpiPill
          label="Revenue"
          value={`${collected.toLocaleString()}`}
          sub={`/ ${TARGET.toLocaleString()} · ${pct}%`}
          color={revenueColor}
        />
        {highCount > 0 && (
          <KpiPill
            label="High ⚡"
            value={highCount}
            sub="energy tasks"
            color="text-red-400"
          />
        )}
        <KpiPill
          label="Time"
          value={now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          sub={now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          color="text-white/70"
        />
      </div>

      <div className="flex gap-4 items-start">

        {/* ── Vertical Day Timeline ──────────────────────────────────────── */}
        <div className="flex-1 relative">

          {/* Unscheduled Tray */}
          {unscheduled.length > 0 && (
            <div className="mb-4 bg-white/3 border border-dashed border-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <LayoutGrid size={12} className="text-white/30" />
                <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Unscheduled — {unscheduled.length}</span>
                <span className="text-[10px] text-white/20">Tell Jarvis "ora X" to slot them in</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {unscheduled.slice(0, 6).map(t => (
                  <TaskBlock key={t.id} task={t} />
                ))}
                {unscheduled.length > 6 && (
                  <span className="text-[10px] text-white/25 text-center py-1">+{unscheduled.length - 6} more</span>
                )}
              </div>
            </div>
          )}

          {/* Hour rows */}
          <div className="relative flex flex-col" id="hour-timeline">
            {HOURS.map((h) => {
              const isCurrentHour = h === currentHour && nowIsInView;
              const isPast = h < currentHour;
              const tasks = tasksByHour[h] || [];
              const isNowRow = h === currentHour;

              return (
                <div key={h} className="relative group">
                  {/* Now line — rendered between the correct rows */}
                  {isNowRow && nowIsInView && (
                    <div
                      ref={nowLineRef}
                      className="absolute left-0 right-0 z-20 flex items-center gap-2 pointer-events-none"
                      style={{ top: `${(currentMinute / 60) * 100}%` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,1)] flex-shrink-0" />
                      <div className="flex-1 h-px bg-blue-400/60 shadow-[0_0_4px_rgba(96,165,250,0.6)]" />
                      <span className="text-[10px] text-blue-400 font-mono font-bold flex-shrink-0 pr-2">
                        {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  <div className={`flex gap-3 min-h-[56px] py-1.5 border-b transition-colors ${
                    isCurrentHour
                      ? 'border-blue-500/20 bg-blue-500/4'
                      : isPast
                        ? 'border-white/3 opacity-40'
                        : 'border-white/5 hover:bg-white/2'
                  }`}>
                    {/* Hour label */}
                    <div className="w-12 flex-shrink-0 flex items-start justify-end pt-1.5">
                      <span className={`text-[11px] font-mono font-semibold ${
                        isCurrentHour ? 'text-blue-400' : isPast ? 'text-white/20' : 'text-white/30'
                      }`}>
                        {String(h).padStart(2, '0')}:00
                      </span>
                    </div>

                    {/* Tasks in this slot */}
                    <div className="flex-1 flex flex-col gap-1.5 justify-center">
                      {tasks.length > 0 ? (
                        tasks.map(t => <TaskBlock key={t.id} task={t} />)
                      ) : (
                        <div className="h-8 flex items-center">
                          <div className="h-px w-full border-t border-dashed border-white/4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {scheduled.length === 0 && unscheduled.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <Clock size={40} className="text-white/10 mb-3" />
              <p className="text-white/20 text-sm">No tasks yet.</p>
              <p className="text-white/15 text-xs mt-1">Tell Jarvis what you're working on.</p>
            </div>
          )}
        </div>

        {/* ── Compact Week View ──────────────────────────────────────────── */}
        <div className="hidden md:flex flex-col gap-1.5 w-28 flex-shrink-0 pt-1">
          <div className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1 text-center">This Week</div>
          {weekDates.map((d, i) => {
            const key = d.toISOString().slice(0, 10);
            const count = taskCountByDate[key] || 0;
            const isToday = key === todayKey;
            const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all ${
                  isToday
                    ? 'bg-blue-500/15 border border-blue-500/30'
                    : 'bg-white/3 border border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`text-[11px] font-semibold leading-none ${isToday ? 'text-blue-300' : isPast ? 'text-white/25' : 'text-white/60'}`}>
                    {DAYS_SHORT[i]}
                  </span>
                  <span className={`text-[10px] leading-none mt-0.5 font-mono ${isToday ? 'text-blue-400/70' : 'text-white/20'}`}>
                    {d.getDate()}
                  </span>
                </div>
                {count > 0 && (
                  <span className={`text-[10px] font-bold font-mono tabular-nums flex-shrink-0 ${
                    isToday ? 'text-blue-300' : 'text-white/30'
                  }`}>
                    {count}
                  </span>
                )}
                {count === 0 && !isPast && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/8 flex-shrink-0" />
                )}
                {isPast && !isToday && (
                  <ChevronRight size={10} className="text-white/10 flex-shrink-0" />
                )}
              </div>
            );
          })}

          {/* Revenue mini bar */}
          <div className="mt-3 bg-white/3 border border-white/5 rounded-xl p-2.5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Revenue</div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  pct >= 100 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className={`text-[10px] font-mono font-bold mt-1 ${revenueColor}`}>{pct}%</div>
          </div>

          {/* High energy warning (only if ≥3 high tasks) */}
          {highCount >= 3 && (
            <div className="mt-2 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl px-2.5 py-2">
              <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-300 leading-tight">{highCount} high energy — watch burnout</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DashboardView;

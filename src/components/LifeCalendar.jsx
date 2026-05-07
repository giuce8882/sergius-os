import React, { useMemo } from 'react';
import GlassPanel from './GlassPanel';
import { Sparkles, Activity, Briefcase, Heart, Calendar } from 'lucide-react';

export default function LifeCalendar({ todos, onClose }) {
    // Generate the last 14 days and next 14 days for a continuous rolling view
    const days = useMemo(() => {
        const today = new Date();
        const d = [];
        for (let i = -14; i <= 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            d.push(date);
        }
        return d;
    }, []);

    // Helper: Find tasks scheduled for a specific date (mock logic based on creation time for now)
    const getTasksForDate = (date) => {
        return todos.filter(t => {
            // In a real app, t.dueDate would exist. For now, random distribution based on ID for visual proof-of-concept
            const pseudoRandomDay = (t.id % 29) - 14;
            const tDate = new Date();
            tDate.setDate(tDate.getDate() + pseudoRandomDay);
            return tDate.toDateString() === date.toDateString();
        });
    };

    const getBubbleStyle = (category, energy, count) => {
        const baseSize = 40;
        // Size grows with task count and High energy tags
        const size = Math.min(100, baseSize + (count * 10) + (energy === 'high' ? 20 : 0));

        let colorClass = 'bg-white/10 border-white/20'; // Default General
        let auraClass = '';

        if (category === 'business') {
            colorClass = 'bg-amber-500/40 border-amber-400/60 shadow-[0_0_30px_rgba(245,158,11,0.4)]';
            auraClass = 'rounded-xl backdrop-blur-md'; // Blockier
        } else if (category === 'personal') {
            colorClass = 'bg-blue-500/40 border-blue-400/50 shadow-[0_0_40px_rgba(59,130,246,0.3)]';
            auraClass = 'rounded-full mix-blend-screen'; // Soft Aura
        } else if (category === 'health') {
            colorClass = 'bg-emerald-500/10 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]';
            auraClass = 'rounded-full border-[3px] animate-pulse'; // Pulsing ring
        } else {
            auraClass = 'rounded-full';
        }

        return {
            width: `${size}px`,
            height: `${size}px`,
            className: `${colorClass} ${auraClass} flex items-center justify-center transition-all duration-500 hover:scale-110 cursor-pointer`
        };
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col p-6 md:p-12 animate-fade-in bg-black/40 backdrop-blur-[60px]">
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40 drop-shadow-sm tracking-tight mb-2">Life Calendar</h1>
                    <p className="text-white/50 text-xl">The 'Bubble Matrix' Heatmap view.</p>
                </div>
                <button onClick={onClose} className="p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors border border-white/10">
                    <span className="text-lg font-bold">ESC</span>
                </button>
            </header>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
                <GlassPanel className="p-8 border-white/5 bg-black/40">
                    <div className="grid grid-cols-7 gap-y-16 gap-x-4 place-items-center">
                        {/* Day Headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-white/40 font-mono text-sm tracking-widest uppercase mb-4">{d}</div>
                        ))}

                        {/* Calendar Grid */}
                        {days.map((date, i) => {
                            const isToday = date.toDateString() === new Date().toDateString();
                            const dayTasks = getTasksForDate(date);

                            // Determine dominant category for the day
                            let dominantCat = 'general';
                            let highEnergy = false;

                            if (dayTasks.length > 0) {
                                const hasBusiness = dayTasks.some(t => t.projectId === 'business' || t.projectId === 'LiquidTodo' || t.text.toLowerCase().includes('work'));
                                const hasHealth = dayTasks.some(t => t.text.toLowerCase().includes('health') || t.text.toLowerCase().includes('gym'));

                                if (hasBusiness) dominantCat = 'business';
                                else if (hasHealth) dominantCat = 'health';
                                else if (dayTasks.some(t => t.projectId)) dominantCat = 'personal';

                                highEnergy = dayTasks.some(t => t.energy === 'high');
                            }

                            const bubble = dayTasks.length > 0 ? getBubbleStyle(dominantCat, highEnergy ? 'high' : 'normal', dayTasks.length) : null;

                            return (
                                <div key={i} className="relative flex flex-col items-center justify-center w-full aspect-square group">
                                    <span className={`absolute top-0 text-xs font-mono font-bold z-10 ${isToday ? 'text-amber-400' : 'text-white/30 group-hover:text-white/80'}`}>
                                        {date.getDate()}
                                    </span>

                                    {/* The Heatmap Bubble */}
                                    <div className="flex-1 w-full flex items-center justify-center mt-4">
                                        {bubble ? (
                                            <div
                                                className={bubble.className}
                                                style={{ width: bubble.width, height: bubble.height }}
                                            >
                                                <span className="text-white/90 font-bold text-lg">{dayTasks.length}</span>
                                            </div>
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-white/5 transition-colors group-hover:bg-white/20"></div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </GlassPanel>
            </div>
        </div>
    );
}

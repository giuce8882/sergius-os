import React from 'react';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';

const StatusPanel = ({ activeTodosCount, todos = [] }) => {
    const isOverwhelmed = activeTodosCount > 5;

    const top3 = todos
        .filter(t => !t.completed)
        .sort((a, b) => {
            if (a.energy === 'high' && b.energy !== 'high') return -1;
            if (b.energy === 'high' && a.energy !== 'high') return 1;
            return 0;
        })
        .slice(0, 3);

    return (
        <div className={`rounded-2xl border px-3 py-3 transition-all duration-500 mb-3 backdrop-blur-md ${isOverwhelmed
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-emerald-500/10 border-emerald-500/20'
            }`}>

            <div className="flex items-center gap-2 mb-2.5">
                <div className={`p-1.5 rounded-full flex-shrink-0 ${isOverwhelmed ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {isOverwhelmed ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
                </div>
                <div className="flex-1 min-w-0 flex items-baseline gap-2">
                    <h3 className="text-sm font-bold text-white leading-tight">
                        {isOverwhelmed ? 'Your 3 moves' : 'Your 3 Moves Today'}
                    </h3>
                    <span className="text-white/40 text-xs">
                        {activeTodosCount === 0 ? 'all clear' : `${activeTodosCount} active`}
                    </span>
                </div>
            </div>

            {top3.length > 0 && (
                <div className="space-y-1.5">
                    {top3.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
                            <span className="text-white/40 text-xs font-bold w-4 flex-shrink-0">{i + 1}.</span>
                            <span className="text-white/85 text-sm leading-snug flex-1 min-w-0 truncate">{t.text}</span>
                            {t.energy === 'high' && <Zap size={11} className="text-red-400 flex-shrink-0" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StatusPanel;

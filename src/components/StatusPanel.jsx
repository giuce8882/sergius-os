import React from 'react';
import { AlertCircle, CheckCircle, Zap, Circle } from 'lucide-react';

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
        <div className={`glass-panel p-4 transition-all duration-500 mb-6 ${isOverwhelmed
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-emerald-500/10 border-emerald-500/20'
            }`}>

            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-full flex-shrink-0 ${isOverwhelmed ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {isOverwhelmed ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white leading-tight">
                        {isOverwhelmed ? `${activeTodosCount} tasks — your 3 moves` : 'Your 3 Moves Today'}
                    </h3>
                    <p className="text-white/40 text-xs">
                        {activeTodosCount === 0 ? 'All clear. Add something.' : `${activeTodosCount} active task${activeTodosCount !== 1 ? 's' : ''}`}
                    </p>
                </div>
            </div>

            {top3.length > 0 && (
                <div className="space-y-1.5">
                    {top3.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
                            <span className="text-white/30 text-xs font-mono w-4 flex-shrink-0">{i + 1}</span>
                            <Circle size={11} className="text-white/20 flex-shrink-0" />
                            <span className="text-white/80 text-sm truncate flex-1">{t.text}</span>
                            {t.energy === 'high' && <Zap size={11} className="text-red-400 flex-shrink-0" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StatusPanel;

import React, { useState } from 'react';
import { CheckCircle2, Circle, Trash2, Clock, Zap, Target, MessageCircle, Lightbulb, Hammer, Rocket, Check } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';

const STAGES = ['Idea', 'Development', 'In Production', 'Paid/Wrapped'];

const TodoItem = ({
    todo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    isSubtask,
    onStartFocus,
    onBrainstorm
}) => {
    const isDeadlineMode = todo.text.toLowerCase().includes('ora 19');
    const controls = useAnimation();
    const [isDragging, setIsDragging] = useState(false);

    // In Production glow effect
    const isProduction = todo.stage === 'In Production';

    const handleEnergyToggle = (e) => {
        e.stopPropagation();
        const nextEnergy = todo.energy === 'high' ? 'low' : todo.energy === 'low' ? null : 'high';
        updateTodo(todo.id, { energy: nextEnergy });
    };

    const cycleStage = (e) => {
        e.stopPropagation();
        const currentStage = todo.stage || 'Idea';
        const currentIndex = STAGES.indexOf(currentStage);
        const nextStage = STAGES[(currentIndex + 1) % STAGES.length];
        updateTodo(todo.id, { stage: nextStage });
    };

    const StageIcon = () => {
        const stage = todo.stage || 'Idea';
        if (stage === 'Idea') return <Lightbulb size={14} className="text-yellow-400" />;
        if (stage === 'Development') return <Hammer size={14} className="text-blue-400" />;
        if (stage === 'In Production') return <Rocket size={14} className="text-purple-400" />;
        if (stage === 'Paid/Wrapped') return <Check size={14} className="text-green-400" />;
        return <Lightbulb size={14} className="text-white/40" />;
    };

    const handleDragStart = () => setIsDragging(true);

    const handleDragEnd = (_, info) => {
        setIsDragging(false);
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        if (offset > 80 || velocity > 500) {
            // Swipe Right: Brainstorm
            if (navigator.vibrate) navigator.vibrate(50);
            if (onBrainstorm) onBrainstorm();
        } else if (offset < -80 || velocity < -500) {
            // Swipe Left: Complete
            if (navigator.vibrate) navigator.vibrate(50);
            toggleTodo(todo.id);
        }
        controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } });
    };

    return (
        <div className="relative mb-3 group rounded-2xl">
            {/* Background Action Layer revealed on swipe */}
            {!isSubtask && isDragging && (
                <div className="absolute inset-0 flex items-center justify-between px-6 bg-black/40 rounded-2xl border border-white/5 pointer-events-none">
                    <div className="text-blue-400 flex items-center gap-2 font-medium opacity-80">
                        <MessageCircle size={20} /> Brainstorm
                    </div>
                    <div className="text-green-400 flex items-center gap-2 font-medium opacity-80">
                        Complete <CheckCircle2 size={20} />
                    </div>
                </div>
            )}

            <motion.div
                drag={isSubtask ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.8}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={controls}
                className={`relative flex items-center justify-between px-3 py-3 rounded-2xl border transition-all duration-500 ${isSubtask
                    ? 'ml-6 bg-[#1a1a1a]/80 border-white/5 backdrop-blur-sm'
                    : 'bg-[#121212]/90 border-white/10 backdrop-blur-xl'
                    } ${todo.completed
                        ? 'opacity-40 scale-[0.98] blur-[2px] z-0'
                        : isSubtask
                            ? 'hover:bg-white/10 shadow-sm z-10'
                            : isProduction
                                ? 'bg-purple-900/20 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.4)] z-30 scale-[1.02]'
                                : isDeadlineMode
                                    ? 'bg-red-900/20 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)] z-30 scale-[1.02]'
                                    : todo.projectColor
                                        ? `${todo.projectColor} shadow-sm z-20`
                                        : 'hover:bg-white/10 shadow-sm opacity-70 blur-[1px] hover:blur-none hover:opacity-100 z-10 scale-[0.99]'
                    }`}
            >
                <div className="flex items-start gap-2.5 flex-1">
                    <button
                        onClick={() => toggleTodo(todo.id)}
                        className={`transition-colors duration-300 flex-shrink-0 mt-0.5 ${todo.completed ? 'text-green-400' : 'text-white/50 hover:text-white'}`}
                    >
                        {todo.completed ? <CheckCircle2 size={isSubtask ? 18 : 20} /> : <Circle size={isSubtask ? 18 : 20} />}
                    </button>

                    <div className="flex flex-col flex-1 min-w-0">
                        <span className={`${isSubtask ? 'text-sm' : 'text-[15px] font-medium'} leading-snug transition-all duration-300 ${todo.completed ? 'line-through text-white/40' : 'text-white/90'}`}>
                            {todo.text}
                        </span>

                        {/* Action row — deadline badge + action buttons */}
                        {!todo.completed && !isSubtask && (
                            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                                {isDeadlineMode && (
                                    <div className="flex items-center gap-1 text-red-400 animate-pulse bg-red-500/10 px-2 py-1 rounded-lg">
                                        <Clock size={11} />
                                        <span className="text-xs font-semibold">19:00</span>
                                    </div>
                                )}

                                {/* Focus Button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onStartFocus(todo); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-white/50 active:bg-amber-400/20 active:text-amber-400 transition-colors"
                                >
                                    <Target size={12} />
                                    <span className="text-xs font-medium">Focus</span>
                                </button>

                                {/* Energy toggle */}
                                <button
                                    onClick={handleEnergyToggle}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                                        todo.energy === 'high'
                                            ? 'bg-red-500/20 text-red-400'
                                            : todo.energy === 'low'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-white/5 text-white/30'
                                    }`}
                                    title={todo.energy === 'high' ? 'High Energy' : todo.energy === 'low' ? 'Low Energy' : 'Set Energy'}
                                >
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${todo.energy === 'high' ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.9)]' : todo.energy === 'low' ? 'bg-green-400' : 'bg-white/25'}`} />
                                    <span className="text-xs font-medium">
                                        {todo.energy === 'high' ? 'High' : todo.energy === 'low' ? 'Low' : 'Energy'}
                                    </span>
                                </button>

                                {/* Stage Icon Toggle */}
                                <button
                                    onClick={cycleStage}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 active:bg-white/15 transition-colors"
                                    title={`Stage: ${todo.stage || 'Idea'}`}
                                >
                                    <StageIcon />
                                    <span className="text-xs text-white/50 font-medium">{todo.stage || 'Idea'}</span>
                                </button>

                                {todo.stage === 'In Production' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onBrainstorm) onBrainstorm(`🎬 Generate a shooting scene breakdown for production: "${todo.text}"`);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 active:bg-purple-500/30 transition-colors"
                                    >
                                        <span className="text-xs font-semibold">🎬 Scenes</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => deleteTodo(todo.id)}
                    className="p-2.5 text-white/30 active:text-red-400 active:bg-red-400/10 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all duration-300 md:opacity-0 md:group-hover:opacity-100 flex-shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
                >
                    <Trash2 size={18} />
                </button>
            </motion.div>
        </div>
    );
};

export default TodoItem;

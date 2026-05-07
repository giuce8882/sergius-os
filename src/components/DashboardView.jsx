import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, DollarSign, Clock, LayoutGrid, Heart, Briefcase, Activity } from 'lucide-react';

// Draggable Project Block
const DraggableBlock = ({ id, task, color, left, width }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `task-${task.id}`,
        data: { task }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        left: `${left}px`,
        width: `${width}px`,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`absolute top-2 h-10 rounded-xl px-3 py-1 flex items-center justify-between cursor-grab active:cursor-grabbing border backdrop-blur-md shadow-sm opacity-90 hover:opacity-100 ${color}`}
        >
            <span className="text-xs font-semibold text-white/90 truncate mr-2">{task.text}</span>
            {task.energy === 'high' && <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />}
            {task.energy === 'low' && <div className="w-2 h-2 rounded-full bg-green-400" />}
        </div>
    );
};

// Droppable Time Slot (Hour)
const DroppableHour = ({ hour, isOver }) => {
    const { setNodeRef } = useDroppable({
        id: `hour-${hour}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex-shrink-0 w-32 h-full border-r border-white/5 relative transition-colors ${isOver ? 'bg-white/10' : ''}`}
        >
            {/* Grid lines or background styling can go here */}
        </div>
    );
};

const DashboardView = ({ todos, setTodos, activeProjects, hashProjectColor, onAiOverlapCheck }) => {

    // X-Axis Timeline (0 to 23 hours for now)
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const HOUR_WIDTH = 128; // width in pixels of each column (w-32 is 8rem = 128px)

    // Derive Priority Domain tasks
    const personalTasks = useMemo(() => {
        return todos.filter(t => t.text.toLowerCase().includes('personal') || t.text.toLowerCase().includes('family') || t.projectId === 'Personal');
    }, [todos]);

    const businessTasks = useMemo(() => {
        return todos.filter(t => t.text.toLowerCase().includes('business') || t.text.toLowerCase().includes('work') || t.projectId === 'Business');
    }, [todos]);

    const healthTasks = useMemo(() => {
        return todos.filter(t => t.text.toLowerCase().includes('health') || t.text.toLowerCase().includes('gym') || t.text.toLowerCase().includes('workout') || t.projectId === 'Health');
    }, [todos]);

    // Budget State synced to localStorage
    const [budgets, setBudgets] = useState({});

    useEffect(() => {
        const savedBudgets = localStorage.getItem('liquidtodo_budgets');
        if (savedBudgets) {
            try { setBudgets(JSON.parse(savedBudgets)); } catch (e) { }
        }
    }, []);

    const updateBudget = (projectId, val) => {
        const newBudgets = { ...budgets, [projectId]: val };
        setBudgets(newBudgets);
        localStorage.setItem('liquidtodo_budgets', JSON.stringify(newBudgets));
    };

    // Aggregate project data (budget, completion, tasks)
    const projectLanes = useMemo(() => {
        return activeProjects.map(pId => {
            // Exclude domains from normal projects if they matched the implicit rule
            const pTasks = todos.filter(t =>
                t.projectId === pId &&
                !personalTasks.find(pt => pt.id === t.id) &&
                !businessTasks.find(bt => bt.id === t.id) &&
                !healthTasks.find(ht => ht.id === t.id)
            );
            const scheduled = pTasks.filter(t => t.hour !== null);
            const completed = pTasks.filter(t => t.completed).length;
            const colorClass = pTasks[0]?.projectColor || hashProjectColor(pId);

            // Energy intensity for the wave background
            const highEnergyCount = scheduled.filter(t => t.energy === 'high').length;
            const lowEnergyCount = scheduled.filter(t => t.energy === 'low').length;

            return {
                id: pId,
                tasks: scheduled,
                total: pTasks.length,
                completed,
                colorClass,
                highEnergyCount,
                lowEnergyCount
            };
        }).filter(lane => lane.tasks.length > 0 || lane.total > 0); // Only show lanes with tasks
    }, [todos, activeProjects, personalTasks, hashProjectColor]);

    // Global Energy Wave (Burnout detection)
    const totalHighEnergy = projectLanes.reduce((acc, lane) => acc + lane.highEnergyCount, 0);
    const isBurnoutRisk = totalHighEnergy >= 1;

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (over && active.id && over.id) {
            const taskId = parseInt(active.id.split('-')[1]);
            const newHour = parseInt(over.id.split('-')[1]);

            const taskToUpdate = todos.find(t => t.id === taskId);
            if (taskToUpdate && taskToUpdate.hour !== newHour) {
                const oldHour = taskToUpdate.hour;
                setTodos(prev => prev.map(t => t.id === taskId ? { ...t, hour: newHour } : t));

                if (onAiOverlapCheck) {
                    onAiOverlapCheck(taskToUpdate.text, oldHour, newHour);
                }
            }
        }
    };

    return (
        <div className="relative w-full h-full min-h-[600px] bg-black/20 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-xl animate-fade-in flex flex-col">

            {/* Energy Wave Background */}
            <div className={`absolute inset-0 opacity-20 transition-colors duration-1000 mix-blend-screen pointer-events-none ${isBurnoutRisk ? 'bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.4),transparent_70%)]' : 'bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1),transparent_70%)]'}`} />

            {/* Timeline Header (X-Axis) */}
            <div className="flex border-b border-white/10 bg-white/5 sticky top-0 z-20">
                <div className="w-24 md:w-64 flex-shrink-0 p-2 md:p-4 border-r border-white/10 backdrop-blur-md font-semibold text-white/50 flex flex-col md:flex-row items-center justify-between text-xs md:text-base">
                    <span className="truncate">Lanes</span>
                    {isBurnoutRisk && <AlertCircle size={16} className="text-red-400 animate-pulse mt-1 md:mt-0" title="Burnout Risk" />}
                </div>
                <div className="flex overflow-x-auto no-scrollbar" id="timeline-scroll">
                    {hours.map(h => (
                        <div key={h} className="flex-shrink-0 w-32 px-2 py-3 text-center text-xs font-mono text-white/40 border-r border-white/5">
                            {h.toString().padStart(2, '0')}:00
                        </div>
                    ))}
                </div>
            </div>

            {/* Lanes Container */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative z-10">
                <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>

                    {/* Personal Life Lane (Always Pinned) */}
                    <div className="flex border-b border-white/5 bg-blue-500/5 hover:bg-white/5 transition-colors group">
                        <div className="w-24 md:w-64 flex-shrink-0 p-2 md:p-4 border-r border-white/10 flex flex-col justify-center text-center md:text-left">
                            <h3 className="font-bold text-blue-300 flex flex-col md:flex-row items-center md:gap-2 text-xs md:text-base tracking-tight"><Heart size={16} className="mb-1 md:mb-0" /> Personal</h3>
                            <p className="text-[10px] md:text-xs text-white/40 mt-1">{personalTasks.length} tasks</p>
                        </div>
                        <div className="flex relative items-center">
                            {/* Hourly drop zones */}
                            {hours.map(h => <DroppableHour key={`personal-hr-${h}`} hour={h} />)}

                            {/* Draggable tasks */}
                            {personalTasks.filter(t => t.hour !== null).map(task => (
                                <DraggableBlock
                                    key={task.id}
                                    id={task.id}
                                    task={task}
                                    color="bg-blue-500/30 border-blue-400/30"
                                    left={task.hour * HOUR_WIDTH + 8}
                                    width={HOUR_WIDTH - 16}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Business Lane */}
                    <div className="flex border-b border-white/5 bg-amber-500/5 hover:bg-white/5 transition-colors group">
                        <div className="w-24 md:w-64 flex-shrink-0 p-2 md:p-4 border-r border-white/10 flex flex-col justify-center text-center md:text-left">
                            <h3 className="font-bold text-amber-300 flex flex-col md:flex-row items-center md:gap-2 text-xs md:text-base tracking-tight"><Briefcase size={16} className="mb-1 md:mb-0" /> Business</h3>
                            <p className="text-[10px] md:text-xs text-white/40 mt-1">{businessTasks.length} tasks</p>
                        </div>
                        <div className="flex relative items-center">
                            {hours.map(h => <DroppableHour key={`biz-hr-${h}`} hour={h} />)}

                            {businessTasks.filter(t => t.hour !== null).map(task => (
                                <DraggableBlock
                                    key={task.id}
                                    id={task.id}
                                    task={task}
                                    color="bg-amber-500/30 border-amber-400/30"
                                    left={task.hour * HOUR_WIDTH + 8}
                                    width={HOUR_WIDTH - 16}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Health Lane */}
                    <div className="flex border-b border-white/5 bg-emerald-500/5 hover:bg-white/5 transition-colors group">
                        <div className="w-24 md:w-64 flex-shrink-0 p-2 md:p-4 border-r border-white/10 flex flex-col justify-center text-center md:text-left">
                            <h3 className="font-bold text-emerald-300 flex flex-col md:flex-row items-center md:gap-2 text-xs md:text-base tracking-tight"><Activity size={16} className="mb-1 md:mb-0" /> Health</h3>
                            <p className="text-[10px] md:text-xs text-white/40 mt-1">{healthTasks.length} tasks</p>
                        </div>
                        <div className="flex relative items-center">
                            {hours.map(h => <DroppableHour key={`health-hr-${h}`} hour={h} />)}

                            {healthTasks.filter(t => t.hour !== null).map(task => (
                                <DraggableBlock
                                    key={task.id}
                                    id={task.id}
                                    task={task}
                                    color="bg-emerald-500/30 border-emerald-400/30"
                                    left={task.hour * HOUR_WIDTH + 8}
                                    width={HOUR_WIDTH - 16}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Dynamic Project Lanes */}
                    {projectLanes.map(lane => (
                        <div key={lane.id} className="flex border-b border-white/5 hover:bg-white/5 transition-colors group">

                            {/* Lane Header (Y-Axis) */}
                            <div className="w-24 md:w-64 flex-shrink-0 p-2 md:p-4 border-r border-white/10 flex flex-col justify-center">
                                <h3 className="font-bold text-white/90 truncate capitalize mb-2 text-[10px] md:text-sm text-center md:text-left">{lane.id}</h3>

                                {/* Progress & Budget Bar */}
                                <div className="hidden md:block w-full bg-black/40 h-2 rounded-full overflow-hidden mb-1 relative border border-white/10">
                                    <div className={`h-full ${lane.colorClass} transition-all`} style={{ width: `${lane.total > 0 ? (lane.completed / lane.total) * 100 : 0}%` }} />
                                </div>
                                <div className="hidden md:flex justify-between items-center mt-1">
                                    <span className="text-[10px] text-white/40">{lane.completed}/{lane.total} completed</span>
                                    <div className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                                        <DollarSign size={10} className="text-emerald-400" />
                                        <input
                                            type="text"
                                            value={budgets[lane.id] || ''}
                                            onChange={(e) => updateBudget(lane.id, e.target.value)}
                                            placeholder="Budget"
                                            className="bg-transparent text-[10px] text-emerald-400 w-12 outline-none placeholder-emerald-400/30"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Timeline Scroll Area */}
                            <div className="flex relative items-center">
                                {/* Hourly drop zones */}
                                {hours.map(h => <DroppableHour key={`${lane.id}-hr-${h}`} hour={h} />)}

                                {/* Draggable Task Blocks */}
                                {lane.tasks.map(task => (
                                    <DraggableBlock
                                        key={task.id}
                                        id={task.id}
                                        task={task}
                                        color={`${lane.colorClass} border-white/20`}
                                        left={task.hour * HOUR_WIDTH + 8}
                                        width={HOUR_WIDTH - 16}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {projectLanes.length === 0 && personalTasks.length === 0 && (
                        <div className="p-10 text-center text-white/30 flex flex-col items-center">
                            <LayoutGrid size={48} className="mb-4 opacity-20" />
                            <p>Your timeline is empty. Add tasks with "ora X" to see them plot here.</p>
                        </div>
                    )}

                </DndContext>
            </div>
        </div>
    );
};

export default DashboardView;

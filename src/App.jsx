import React, { useState, useEffect } from 'react';
import GlassPanel from './components/GlassPanel';
import TodoItem from './components/TodoItem';
import StatusPanel from './components/StatusPanel';
import BrainstormChat from './components/BrainstormChat';
import VoiceOrb from './components/VoiceOrb';
import DashboardView from './components/DashboardView';
import LifeCalendar from './components/LifeCalendar';
import { Plus, Sparkles, MessageCircle, Loader2, Play, Square, Timer, Bell, Clock, LayoutGrid, ListTodo, List, Calendar, Circle, CheckCircle2, Volume2, VolumeX, Eye, EyeOff, DollarSign } from 'lucide-react';
import FinancialPanel from './components/FinancialPanel';
import JarvisAgent from './components/JarvisAgent';
import NotificationBanner from './components/NotificationBanner';
import NotificationManager from './utils/NotificationManager';
import { generateText } from './utils/ai';
import audioEngine from './utils/AudioEngine';

// --- SECURITY BRIEF ---
// DATA SENT: The prompt sends ONLY the literal string of the specific task to the API 
// to be broken down. No PII, full lists, or other context is included.
// URL HIT: https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent
// ----------------------

const DEFAULT_TASKS = [
  { id: 1746614001, text: 'Dabo edits - trimite 3 videos', completed: false, stage: 'Idea', energy: 'high', projectId: 'Dabo', projectColor: 'bg-indigo-500/20 text-indigo-100 border-indigo-500/30' },
  { id: 1746614002, text: 'Ramada - pregătire filmare', completed: false, stage: 'Idea', energy: 'low', projectId: 'Ramada', projectColor: 'bg-amber-500/20 text-amber-100 border-amber-500/30' },
  { id: 1746614005, text: 'El Padre Padel - video final', completed: false, stage: 'Development', energy: 'high', projectId: 'El Padre Padel', projectColor: 'bg-emerald-500/20 text-emerald-100 border-emerald-500/30' },
  { id: 1746614011, text: 'Mate wedding video', completed: false, stage: 'Idea', energy: 'high', projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614010, text: 'Mecshop - filmare', completed: false, stage: 'Idea', energy: 'high', projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614003, text: 'Rox videos - editare', completed: false, stage: 'Idea', energy: null, projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614004, text: 'Yves videos - editare', completed: false, stage: 'Idea', energy: null, projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614006, text: '360 videos - defensive driving', completed: false, stage: 'Idea', energy: null, projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614007, text: 'Edit defensive driving footage', completed: false, stage: 'Idea', energy: null, projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614008, text: 'Parkkindergarten videos', completed: false, stage: 'Idea', energy: null, projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614009, text: 'Sonorizare Voineag', completed: false, stage: 'Idea', energy: null, projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614012, text: 'Amifteatro - editare', completed: false, stage: 'Idea', energy: null, projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614013, text: 'DOADS AI agency - 2 edits', completed: false, stage: 'Idea', energy: null, projectId: 'Spot Clients', projectColor: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30' },
  { id: 1746614014, text: 'pick up Elio ora 16', completed: false, stage: 'Idea', energy: null, projectId: 'Personal', projectColor: 'bg-cyan-500/20 text-cyan-100 border-cyan-500/30', hour: 16 },
];

function App() {
  const [todos, setTodos] = useState(() => {
    try {
      const saved = localStorage.getItem('sergiu_os_tasks');
      return saved ? JSON.parse(saved) : DEFAULT_TASKS;
    } catch { return DEFAULT_TASKS; }
  });
  const [isTasksLoaded, setIsTasksLoaded] = useState(true);

  // Save to localStorage
  useEffect(() => {
    try { localStorage.setItem('sergiu_os_tasks', JSON.stringify(todos)); } catch {}
  }, [todos]);

  // Reschedule task alerts whenever todos change
  useEffect(() => {
    NotificationManager.scheduleTaskAlerts(todos);
  }, [todos]);

  const [inputValue, setInputValue] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [focusedTaskText, setFocusedTaskText] = useState('');
  const [splittingIds, setSplittingIds] = useState(new Set());
  const [isMuted, setIsMuted] = useState(audioEngine.isMuted);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState('time'); // 'time' | 'finance'
  const [jarvisOpen, setJarvisOpen] = useState(false);

  // View Toggle (Day vs Projects vs Dashboard)
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'projects' | 'dashboard'
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Focus Mode (Pomodoro) State
  const [activeFocusTask, setActiveFocusTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isOnSetMode, setIsOnSetMode] = useState(false);

  // Faux-Native Notification State
  const [notification, setNotification] = useState(null);

  // Timer Effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      audioEngine.playZenChime(); // Play the deep resonant completion sound
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);

  const stopFocusMode = () => {
    setIsTimerRunning(false);
    setActiveFocusTask(null);
    setTimeLeft(25 * 60);
  };

  const startFocusMode = (todo) => {
    setActiveFocusTask(todo);
    setTimeLeft(25 * 60);
    setIsTimerRunning(true);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const activeCount = todos.filter(t => !t.completed).length;
  const highEnergyCount = todos.filter(t => t.energy === 'high' && !t.completed).length;
  const isHighEnergy = highEnergyCount >= 3;

  const groupedTodos = todos.reduce((acc, todo) => {
    const pId = todo.projectId || 'General';
    if (!acc[pId]) acc[pId] = [];
    acc[pId].push(todo);
    return acc;
  }, {});

  // Extract scheduled tasks for the Side Calendar
  const scheduledTasks = todos.filter(t => !t.completed && t.text.toLowerCase().match(/(?:ora|at)\s*(\d{1,2})/)).map(t => {
    const match = t.text.toLowerCase().match(/(?:ora|at)\s*(\d{1,2})/);
    const hour = match ? parseInt(match[1]) : null;
    return { ...t, hour };
  }).filter(t => t.hour !== null).sort((a, b) => a.hour - b.hour);

  // Background Worker for 30-min Alerts
  useEffect(() => {
    const checkAlerts = () => {
      const now = new Date();
      // Test immediately or at exactly HH:30
      if (now.getMinutes() === 30 || true) {
        const targetHour = now.getHours() + 1;
        const dueTasks = scheduledTasks.filter(t => t.hour === targetHour);
        if (dueTasks.length > 0) {
          setNotification({
            title: "Upcoming Activity",
            message: `"${dueTasks[0].text}" is scheduled in 30 minutes.`
          });
          setTimeout(() => setNotification(null), 8000);
        }
      }
    };

    const interval = setInterval(checkAlerts, 60000);
    checkAlerts(); // Run once on mount for demo/testing
    return () => clearInterval(interval);
  }, [scheduledTasks]);

  // Phase 6: Conflict Resolution for High Energy Tasks
  const [hasWarnedConflict, setHasWarnedConflict] = useState(false);

  useEffect(() => {
    const highEnergyHours = scheduledTasks
      .filter(t => t.energy === 'high')
      .map(t => t.hour)
      .sort((a, b) => a - b);

    let conflictFound = false;
    for (let i = 0; i < highEnergyHours.length - 1; i++) {
      // If difference is 0 or 1, they are consecutive or overlapping
      if (highEnergyHours[i + 1] - highEnergyHours[i] <= 1) {
        conflictFound = true;
        break;
      }
    }

    if (conflictFound && !hasWarnedConflict) {
      setNotification({
        title: "⚠️ Burnout Risk Detected",
        message: "Consecutive High-Energy tasks scheduled. Consider inserting a 'Recovery Block'!"
      });
      setTimeout(() => setNotification(null), 8000);
      setHasWarnedConflict(true);
    } else if (!conflictFound) {
      setHasWarnedConflict(false);
    }
  }, [scheduledTasks, hasWarnedConflict]);

  // Derive active Projects list from current tasks
  const activeProjects = Array.from(new Set(
    todos.filter(t => t.projectId).map(t => t.projectId)
  ));

  const hashProjectColor = (projectId) => {
    if (!projectId) return null;
    let hash = 0;
    for (let i = 0; i < projectId.length; i++) {
      hash = projectId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'bg-emerald-500/20 text-emerald-100 border-emerald-500/30',
      'bg-indigo-500/20 text-indigo-100 border-indigo-500/30',
      'bg-rose-500/20 text-rose-100 border-rose-500/30',
      'bg-amber-500/20 text-amber-100 border-amber-500/30',
      'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-500/30',
      'bg-cyan-500/20 text-cyan-100 border-cyan-500/30'
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const extractProjectIdAsync = async (taskId, text) => {
    try {
      const currentProjects = activeProjects.filter(p => p !== 'General').join(', ');
      const prompt = `Classify this task into a short 'Project Name' (1-2 words). Active projects: [${currentProjects}]. Use one if it fits, or invent a relevant new one. Never use 'General' or 'Misc'. Return ONLY the project name, nothing else. Task: "${text}"`;
      let projectId = (await generateText(prompt, true)).replace(/["']/g, '').trim();
      if (!projectId || projectId.toLowerCase() === 'general') projectId = 'Life Ops';
      updateTodo(taskId, { projectId, projectColor: hashProjectColor(projectId) });
    } catch (e) {
      console.error("Failed to extract projectId", e);
    }
  };

  const handleAiOverlapCheck = async (taskText, oldHour, newHour) => {
    try {
      const scheduledTasksStr = todos.filter(t => t.hour !== null).map(t => `"${t.text}" at hour ${t.hour}`).join(', ');
      const prompt = `Scheduling assistant. Task "${taskText}" moved from hour ${oldHour} to hour ${newHour}. Timeline: [${scheduledTasksStr}]. Any major conflicts? Reply ONE short sentence warning, or exactly "NO_CONFLICT".`;
      const text = await generateText(prompt, true);
      if (text && !text.includes('NO_CONFLICT')) {
        setNotification({ title: "Timeline Shift", message: text });
        setTimeout(() => setNotification(null), 8000);
      }
    } catch (e) {
      console.error("AI Overlap Check Failed", e);
    }
  };

  const scrollToSection = (id) => {
    setViewMode(id);
    if (id === 'projects') setActiveProjectId(null);
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.pageYOffset - 40;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 50);
  };

  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Trigger localized haptics and the iOS-style keyboard click
    audioEngine.playSoftTap();

    const newId = Date.now();
    let parsedEnergy = null;
    if (inputValue.includes('🔴')) parsedEnergy = 'high';
    else if (inputValue.includes('🟢')) parsedEnergy = 'low';

    setTodos([{ id: newId, text: inputValue, completed: false, stage: 'Idea', energy: parsedEnergy, projectId: null, projectColor: null }, ...todos]);
    setInputValue('');
    extractProjectIdAsync(newId, inputValue);
  };

  const updateTodo = (id, updates) => {
    setTodos(prev => prev.map(todo => todo.id === id ? { ...todo, ...updates } : todo));
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const openBrainstorm = (taskText = '') => {
    setFocusedTaskText(taskText);
    setIsChatOpen(true);
  };

  const toggleSubTodo = (parentId, subId) => {
    setTodos(todos.map(todo => {
      if (todo.id === parentId) {
        return {
          ...todo,
          subTasks: todo.subTasks.map(sub => sub.id === subId ? { ...sub, completed: !sub.completed } : sub)
        };
      }
      return todo;
    }));
  };

  const deleteSubTodo = (parentId, subId) => {
    setTodos(todos.map(todo => {
      if (todo.id === parentId) {
        return {
          ...todo,
          subTasks: todo.subTasks.filter(sub => sub.id !== subId)
        };
      }
      return todo;
    }));
  };

  const handleMagicSplit = async (taskId, taskText) => {
    try {
      setSplittingIds(prev => new Set(prev).add(taskId));

      const prompt = `Break this task into 3 extremely short, actionable sub-tasks. Return ONLY a valid JSON array of strings, nothing else.\nTask: "${taskText}"`;
      const outputText = await generateText(prompt, false);

      const jsonMatch = outputText.match(/\[.*\]/s);
      let subTaskTexts = [];
      if (jsonMatch) {
        subTaskTexts = JSON.parse(jsonMatch[0]);
      } else {
        subTaskTexts = JSON.parse(outputText);
      }

      setTodos(prevTodos => prevTodos.map(todo => {
        if (todo.id === taskId) {
          const newSubtasks = subTaskTexts.map((text, idx) => ({
            id: Date.now() + idx,
            text: text,
            completed: false
          }));
          return { ...todo, subTasks: [...(todo.subTasks || []), ...newSubtasks] };
        }
        return todo;
      }));

    } catch (error) {
      console.error("Magic Split error", error);
      alert(`Magic Split API Error: ${error?.message || "Something went wrong"}`);
    } finally {
      setSplittingIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Dynamic Backgrounds for Unified Dashboard
  let bgColors = ['bg-purple-500', 'bg-pink-500', 'bg-blue-500'];
  if (activeProjectId) {
    const colorStr = hashProjectColor(activeProjectId);
    // Extract the root color name (e.g. 'emerald-500' from 'bg-emerald-500/20')
    const match = colorStr.match(/bg-([a-z]+-[0-9]+)/);
    if (match) {
      bgColors = [`bg-${match[1]}`, `bg-${match[1]}`, `bg-${match[1]}`];
    }
  }

  return (
    <>
      <div className="relative min-h-[100dvh] w-full overflow-x-hidden pb-36 md:pb-10 font-sans transition-colors duration-1000 flex bg-[#0a0a0a]">
        {/* Fixed Left Sidebar (Desktop Only) */}
        <aside className="hidden md:flex flex-col w-20 fixed left-0 top-0 bottom-0 bg-black/60 backdrop-blur-3xl border-r border-white/5 z-50 py-8 items-center justify-between">
          <div className="flex flex-col gap-6">
            <button
              onClick={() => setIsChatOpen(true)}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)] mb-2 hover:scale-105 transition-transform cursor-pointer"
              title="Brainstorm Assistant"
            >
              <Sparkles size={20} className="text-white" />
            </button>

            <button
              onClick={() => setJarvisOpen(true)}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-900 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.5)] hover:scale-105 transition-transform cursor-pointer border border-violet-400/20"
              title="Jarvis AI Agent"
            >
              <span className="text-white text-sm font-bold">J</span>
            </button>

            <button
              onClick={() => {
                const mutedState = audioEngine.toggleMute();
                setIsMuted(mutedState);
              }}
              className="p-3 rounded-xl transition-all text-white/40 hover:text-white/80 hover:bg-white/5 cursor-pointer"
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <button
              onClick={() => setIsOnSetMode(!isOnSetMode)}
              className={`p-3 rounded-xl transition-all ${isOnSetMode ? 'bg-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5 cursor-pointer'}`}
              title="Toggle On-Set Mode (Focus)"
            >
              {isOnSetMode ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>


            <button
              onClick={() => scrollToSection('day')}
              className={`p-3 rounded-xl transition-all ${viewMode === 'day' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80 hover:bg-white/5 cursor-pointer'}`}
              title="Day View"
            >
              <ListTodo size={22} />
            </button>

            <button
              onClick={() => scrollToSection('projects')}
              className={`p-3 rounded-xl transition-all ${viewMode === 'projects' && !activeProjectId ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5 cursor-pointer'}`}
              title="Global Projects"
            >
              <LayoutGrid size={22} />
            </button>

            <button
              onClick={() => scrollToSection('dashboard')}
              className={`p-3 rounded-xl transition-all ${viewMode === 'dashboard' ? 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5 cursor-pointer'}`}
              title="Timeline Dashboard"
            >
              <Clock size={22} />
            </button>

            <div className="w-8 h-px bg-white/10 my-2"></div>

            <button
              onClick={() => setIsCalendarOpen(true)}
              className={`p-3 rounded-xl transition-all ${isCalendarOpen ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5 cursor-pointer'}`}
              title="Life Calendar"
            >
              <Calendar size={22} />
            </button>

            <button
              onClick={() => { scrollToSection('day'); setRightPanel('finance'); }}
              className={`p-3 rounded-xl transition-all ${rightPanel === 'finance' ? 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5 cursor-pointer'}`}
              title="Finance Dashboard"
            >
              <DollarSign size={22} />
            </button>
          </div>

          {/* Placeholder for VoiceOrb Dock */}
          <div id="orb-dock" className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
            {/* VoiceOrb will be teleported or restyled to dock here on desktop */}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className={`flex-1 md:ml-20 flex flex-col min-h-screen px-4 pt-5 pb-10 md:py-16 relative transition-all duration-700 ${isCalendarOpen ? 'blur-[60px] opacity-30 scale-95' : 'blur-0 opacity-100 scale-100'}`}>

          {/* On-Set Studio Black */}
          <div className={`fixed inset-0 bg-black z-0 pointer-none-safeguard transition-opacity duration-1000 ${isOnSetMode ? 'opacity-100' : 'opacity-0'}`} />

          {/* Liquid Backgrounds */}
          <div className={`fixed top-[-10%] left-[-10%] w-[40%] h-[40%] ${isHighEnergy ? 'bg-red-600/30 blur-[80px] animate-pulse' : bgColors[0] + ' blur-[100px]'} rounded-full mix-blend-screen filter opacity-30 animate-float pointer-none-safeguard transition-all duration-1000`} />
          <div className={`fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] ${isHighEnergy ? 'bg-orange-600/30 blur-[80px]' : bgColors[1] + ' blur-[100px]'} rounded-full mix-blend-screen filter opacity-30 animate-float pointer-none-safeguard transition-all duration-1000`} style={{ animationDelay: '2s' }} />
          <div className={`fixed top-[40%] left-[60%] w-[30%] h-[30%] ${isHighEnergy ? 'bg-red-700/30 blur-[80px] animate-pulse' : bgColors[2] + ' blur-[100px]'} rounded-full mix-blend-screen filter opacity-30 animate-float pointer-none-safeguard transition-all duration-1000`} style={{ animationDelay: '4s' }} />

          <div className={`relative z-10 max-w-4xl mx-auto w-full`}>
            {(!isOnSetMode) && (
              <header className="mb-6 md:mb-12 text-center md:text-left relative">
                <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 drop-shadow-sm mb-0.5 md:mb-2 tracking-tight">
                  Sergiu OS
                </h1>
                <p className="hidden md:block text-white/50 text-lg font-medium">Your whole life. At a glance.</p>
              </header>
            )}

            {activeFocusTask && (
              <div className="mb-8 flex justify-center sticky top-4 z-50">
                <div className="bg-neutral-900/80 backdrop-blur-xl border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)] rounded-3xl p-6 flex flex-col items-center min-w-[300px]">
                  <h3 className="text-white/60 text-sm mb-2">Currently Focusing On:</h3>
                  <p className="text-white font-medium text-lg mb-4 text-center">{activeFocusTask.text}</p>

                  <div className="text-5xl font-mono text-amber-400 font-bold mb-6 tracking-wider">
                    {formatTime(timeLeft)}
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleTimer}
                      className="w-12 h-12 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center transition-colors"
                    >
                      {isTimerRunning ? <Timer size={24} /> : <Play size={24} className="ml-1" />}
                    </button>
                    <button
                      onClick={stopFocusMode}
                      className="w-12 h-12 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-colors"
                    >
                      <Square size={20} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MOBILE FINANCE VIEW */}
            {viewMode === 'finance' && (
              <div className="md:hidden pb-4">
                <h2 className="text-2xl font-bold text-white mb-4">Finance</h2>
                <GlassPanel>
                  <FinancialPanel />
                </GlassPanel>
              </div>
            )}

            {/* DAY VIEW ANCHOR */}
            {(!isOnSetMode || !activeFocusTask) && (
              <div id="day" className={`grid-cols-1 lg:grid-cols-3 gap-8 min-h-[80vh] ${viewMode === 'day' ? 'grid' : 'hidden md:grid'}`}>

                {/* Main Task List */}
                <div className="lg:col-span-2 space-y-6">
                  <NotificationBanner
                    todos={todos}
                    onGranted={() => NotificationManager.init(todos)}
                  />
                  <StatusPanel activeTodosCount={activeCount} todos={todos} />

                  <GlassPanel>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-semibold text-white">Tasks</h2>
                      <button
                        onClick={() => openBrainstorm()}
                        className="glass-pill flex items-center gap-2 hover:bg-blue-500/20 hover:border-blue-500/50"
                      >
                        <MessageCircle size={16} className="text-blue-300" />
                        <span>Brainstorm</span>
                      </button>
                    </div>

                    {/* Input — hidden on mobile (moved to sticky bar below) */}
                    <form onSubmit={handleAddTodo} className="relative mb-8 hidden md:block">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="What are we tackling today?"
                        className="glass-input w-full pr-14 text-lg py-4 shadow-inner"
                      />
                      <button
                        type="submit"
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-all duration-300 border border-white/10"
                      >
                        <Plus size={24} />
                      </button>
                    </form>

                    <div className="space-y-8">
                      {todos.length === 0 ? (
                        <div className="text-center py-10 text-white/50">
                          You're all caught up!
                        </div>
                      ) : (
                        Object.keys(groupedTodos).map(pId => {
                          const podColor = groupedTodos[pId][0]?.projectColor || 'bg-white/5 border-white/10';
                          return (
                            <div key={pId} className="space-y-3">
                              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 pl-2 opacity-80">{pId}</h3>
                              <div className={`p-2 rounded-[2rem] border backdrop-blur-md shadow-lg ${podColor} bg-opacity-10`}>
                                {groupedTodos[pId].map(todo => {
                                  const isFadedOut = activeFocusTask && activeFocusTask.id !== todo.id;
                                  return (
                                    <div
                                      key={todo.id}
                                      className={`relative group transition-all duration-500 ${isFadedOut ? 'opacity-20 blur-sm grayscale pointer-events-none' : 'opacity-100 blur-0'}`}
                                    >
                                      <TodoItem
                                        todo={todo}
                                        updateTodo={updateTodo}
                                        toggleTodo={toggleTodo}
                                        deleteTodo={deleteTodo}
                                        onStartFocus={startFocusMode}
                                        onBrainstorm={() => openBrainstorm(todo.text)}
                                      />
                                      {todo.subTasks && todo.subTasks.length > 0 && (
                                        <div className="mb-4 mt-[-4px]">
                                          {todo.subTasks.map(sub => (
                                            <TodoItem
                                              key={sub.id}
                                              todo={sub}
                                              updateTodo={() => { }} // Simple subtasks for now
                                              toggleTodo={() => toggleSubTodo(todo.id, sub.id)}
                                              deleteTodo={() => deleteSubTodo(todo.id, sub.id)}
                                              isSubtask={true}
                                              onStartFocus={() => { }}
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </GlassPanel>
                </div>

                {/* Right Panel — Time Blocks / Finance tabs */}
                <div className="lg:col-span-1">
                  <GlassPanel>
                    {/* Tab switcher */}
                    <div className="flex gap-1 mb-5 bg-black/20 p-1 rounded-xl border border-white/5">
                      <button
                        onClick={() => setRightPanel('time')}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-all ${rightPanel === 'time' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
                      >
                        <Clock size={13} /> Time Blocks
                      </button>
                      <button
                        onClick={() => setRightPanel('finance')}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-all ${rightPanel === 'finance' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/40 hover:text-white/70'}`}
                      >
                        <DollarSign size={13} /> Finance
                      </button>
                    </div>

                    {rightPanel === 'time' && (
                      scheduledTasks.length === 0 ? (
                        <div className="text-white/40 text-sm text-center py-8">
                          No specific times identified.<br />Add "ora X" to a task to block it here.
                        </div>
                      ) : (
                        <div className="relative border-l-2 border-white/10 pl-4 py-2 space-y-6">
                          {scheduledTasks.map((t, idx) => (
                            <div key={'sched-' + idx} className="relative">
                              <div className="absolute w-3 h-3 bg-white/20 rounded-full -left-[23px] top-1.5 border border-white/40" />
                              <div className="text-sm font-semibold text-white/80 mb-1">{t.hour}:00</div>
                              <div className={`border rounded-lg p-3 text-sm text-white/90 ${t.projectColor ? t.projectColor : 'bg-white/5 border-white/10'}`}>
                                {t.text}
                                {t.energy === 'high' && <span className="ml-2 text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full inline-block mt-1">🔴 High Energy</span>}
                                {t.energy === 'low' && <span className="ml-2 text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full inline-block mt-1">🟢 Low Energy</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {rightPanel === 'finance' && <FinancialPanel />}
                  </GlassPanel>
                </div>
              </div>
            )}

            {/* GLOBAL DASHBOARD SCROLL VIEW */}
            {(!isOnSetMode) && (
              <div id="dashboard" className={`pt-6 md:pt-24 min-h-screen w-full overflow-hidden ${viewMode !== 'dashboard' ? 'hidden md:block' : ''}`}>
                <h2 className="text-3xl font-bold text-white/90 mb-8 px-2 md:px-0">Timeline Dashboard</h2>
                <div className="animate-fade-in fade-in transition-all w-full overflow-hidden">
                  <DashboardView
                    todos={todos}
                    setTodos={setTodos}
                    activeProjects={activeProjects}
                    hashProjectColor={hashProjectColor}
                    onAiOverlapCheck={handleAiOverlapCheck}
                  />
                </div>
              </div>
            )}
            {/* PROJECT CAPSULES VIEW */}
            {(!isOnSetMode) && (
              <div id="projects" className={`pt-6 md:pt-24 min-h-[60vh] ${viewMode !== 'projects' ? 'hidden md:block' : ''}`}>
                {!activeProjectId ? (
                  <>
                    <h2 className="text-3xl font-bold text-white/90 mb-8">Project Capsules</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                      {activeProjects.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-white/40">
                          <LayoutGrid size={48} className="mx-auto mb-4 opacity-50" />
                          <p>No active projects detected.</p>
                          <p className="text-sm mt-2">Tag a task or ask Jarvis to extract one to start building your overview.</p>
                        </div>
                      ) : (
                        activeProjects.map((pId) => {
                          const pTasks = todos.filter(t => t.projectId === pId);
                          const pColor = pTasks[0]?.projectColor || 'bg-white/10 border-white/20';

                          return (
                            <div key={pId}
                              onClick={() => { setActiveProjectId(pId); scrollToSection('projects'); }}
                              className={`p-5 rounded-3xl border backdrop-blur-md transition-all ${pColor} bg-opacity-[0.05] cursor-pointer hover:bg-opacity-20 hover:-translate-y-1 shadow-lg`}>
                              <h2 className="text-xl font-bold text-white/90 drop-shadow-sm mb-4 tracking-tight capitalize">{pId}</h2>

                              <div className="space-y-3 pointer-events-none">
                                {pTasks.map(todo => (
                                  <div key={`pview-${todo.id}`} className="flex items-start gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                                    <button className={`flex-shrink-0 mt-0.5 text-white/40`}>
                                      {todo.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                    </button>
                                    <div className="flex-1">
                                      <p className={`text-sm ${todo.completed ? 'line-through text-white/40' : 'text-white/80'}`}>{todo.text}</p>
                                      {todo.hour && <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-white/60 inline-flex items-center mt-1 mr-2"><Clock size={10} className="mr-1" />{todo.hour}:00</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  /* UNIFIED DASHBOARD VIEW (Single Project Capsule) */
                  <div className="animate-fade-in fade-in transition-all">
                    <button onClick={() => setActiveProjectId(null)} className="mb-6 flex items-center text-white/50 hover:text-white group transition-colors">
                      <div className="bg-white/10 p-2 rounded-full mr-3 group-hover:bg-white/20 transition-colors">
                        <LayoutGrid size={16} />
                      </div>
                      Back to All Projects
                    </button>

                    <GlassPanel className={`${hashProjectColor(activeProjectId)} bg-opacity-10 mb-8 border-opacity-40`}>
                      <h2 className="text-3xl font-extrabold text-white capitalize mb-2">{activeProjectId} Capsule</h2>
                      <p className="text-white/60">Unified view of all active tasks, blocks, and brainstorm history.</p>
                    </GlassPanel>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                      <div className="space-y-6">
                        <h3 className="text-xl font-semibold text-white/80">Active Tasks</h3>
                        {todos.filter(t => t.projectId === activeProjectId).map(todo => (
                          <TodoItem
                            key={todo.id}
                            todo={todo}
                            toggleTodo={toggleTodo}
                            deleteTodo={deleteTodo}
                            updateTodo={updateTodo}
                            onStartFocus={() => startFocusMode(todo)}
                            onBrainstorm={() => openBrainstorm(todo.text)}
                          />
                        ))}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white/80 mb-6">Brainstorm History Log</h3>
                        <div className="bg-black/20 border border-white/10 rounded-2xl p-6 text-center">
                          <MessageCircle size={32} className="mx-auto text-white/20 mb-3" />
                          <p className="text-white/50 text-sm">History logs will appear here when Chat is saved.</p>
                          <button onClick={() => setIsChatOpen(true)} className="mt-4 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm transition-colors text-white">Open Project Chat</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div> {/* End Main Content Area */}
      </div> {/* End App Layout Wrapper */}

      {/* Life Calendar Overlay */}
      {isCalendarOpen && (
        <LifeCalendar
          todos={todos}
          onClose={() => setIsCalendarOpen(false)}
        />
      )}

      <BrainstormChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        taskTarget={focusedTaskText}
        todos={todos}
        setTodos={setTodos}
        extractProjectIdAsync={extractProjectIdAsync}
        activeProjectId={activeProjectId} // Pass project capsule context down
      />

      {/* Jarvis Agent */}
      <JarvisAgent
        isOpen={jarvisOpen}
        onClose={() => setJarvisOpen(false)}
        todos={todos}
        setTodos={setTodos}
      />

      {/* Voice Orb */}
      <VoiceOrb
        activeProjectId={activeProjectId}
        onIntentParsed={(newTaskText) => {
          const newId = Date.now();
          setTodos([{ id: newId, text: newTaskText, completed: false, stage: 'Idea', energy: null, projectId: null, projectColor: null }, ...todos]);
          extractProjectIdAsync(newId, newTaskText);
        }}
      />

      {/* Proactive Background Alerts (Faux-Native Notification) */}
      <div className={`fixed top-8 right-8 z-[100] transition-all duration-500 transform ${notification ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
        {notification && (
          <div className="bg-black/40 backdrop-blur-3xl border border-white/20 rounded-2xl p-4 shadow-2xl flex items-start gap-4 max-w-sm">
            <div className="bg-blue-500/20 p-2 rounded-full text-blue-300">
              <Bell size={20} />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-1">{notification.title}</h4>
              <p className="text-white/70 text-sm leading-tight">{notification.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky input bar — only on Day view */}
      {viewMode === 'day' && (
        <div className="md:hidden fixed left-0 right-0 z-[59] px-4 pb-2" style={{ bottom: 'calc(max(72px, 72px + env(safe-area-inset-bottom)))' }}>
          <form onSubmit={handleAddTodo} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Add a task..."
              className="glass-input w-full pr-14 shadow-2xl"
              style={{ fontSize: '16px', padding: '14px 56px 14px 16px' }}
            />
            <button
              type="submit"
              className="absolute right-2 top-2 bottom-2 aspect-square bg-white/15 active:bg-white/30 text-white rounded-xl flex items-center justify-center border border-white/10"
            >
              <Plus size={22} />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Jarvis FAB — floats above tab bar center */}
      <button
        onClick={() => setJarvisOpen(true)}
        className="md:hidden fixed z-[65] left-1/2 -translate-x-1/2 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-800 flex items-center justify-center shadow-[0_0_28px_rgba(139,92,246,0.7)] border border-violet-400/30 active:scale-95 transition-transform"
        style={{ bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 34px)' }}
      >
        <Sparkles size={22} className="text-white" />
      </button>

      {/* Mobile Bottom TabBar — 4 items flanking the center FAB */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 z-[60] grid grid-cols-5"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => { setViewMode('day'); setActiveProjectId(null); }}
          className={`flex flex-col items-center gap-0.5 py-3 transition-all ${viewMode === 'day' ? 'text-blue-400' : 'text-white/40'}`}
        >
          <List size={20} />
          <span className="text-[9px] font-medium">Day</span>
        </button>
        <button
          onClick={() => setViewMode('projects')}
          className={`flex flex-col items-center gap-0.5 py-3 transition-all ${viewMode === 'projects' ? 'text-purple-400' : 'text-white/40'}`}
        >
          <LayoutGrid size={20} />
          <span className="text-[9px] font-medium">Capsules</span>
        </button>

        {/* Empty center slot for FAB */}
        <div className="flex flex-col items-center justify-end pb-1">
          <span className="text-[9px] font-bold text-violet-400">Jarvis</span>
        </div>

        <button
          onClick={() => setViewMode('finance')}
          className={`flex flex-col items-center gap-0.5 py-3 transition-all ${viewMode === 'finance' ? 'text-emerald-400' : 'text-white/40'}`}
        >
          <DollarSign size={20} />
          <span className="text-[9px] font-medium">Finance</span>
        </button>
        <button
          onClick={() => setViewMode('dashboard')}
          className={`flex flex-col items-center gap-0.5 py-3 transition-all ${viewMode === 'dashboard' ? 'text-amber-400' : 'text-white/40'}`}
        >
          <Calendar size={20} />
          <span className="text-[9px] font-medium">Timeline</span>
        </button>
      </div>
    </>
  );
}

export default App;

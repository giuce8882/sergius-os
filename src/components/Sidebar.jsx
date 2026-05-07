import React from 'react';
import { Sparkles, VolumeX, Volume2, Eye, EyeOff, ListTodo, LayoutGrid, Clock, Calendar, DollarSign } from 'lucide-react';

const Sidebar = ({
  setIsChatOpen,
  setJarvisOpen,
  isMuted,
  setIsMuted,
  audioEngine,
  isOnSetMode,
  setIsOnSetMode,
  scrollToSection,
  viewMode,
  activeProjectId,
  isCalendarOpen,
  setIsCalendarOpen,
  rightPanel,
  setRightPanel
}) => {
  return (
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
  );
};

export default Sidebar;

import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Loader2, Zap } from 'lucide-react';
import Groq from 'groq-sdk';

const MODEL = 'llama-3.3-70b-versatile';

// ── Tools available in Brainstorm mode ──────────────────────────────────────
// A focused subset of Jarvis tools, plus implement_plan for turning ideas into tasks

const BRAINSTORM_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'implement_plan',
      description: 'Turn the brainstormed ideas into real tasks in the app. Use this when the user says "implement this", "add these tasks", "let\'s do it", or similar.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text:      { type: 'string', description: 'Task description' },
                projectId: { type: 'string', description: 'Project name to group under' },
                energy:    { type: 'string', description: '"high", "low", or omit' },
                stage:     { type: 'string', description: 'Idea | Development | In Production | Paid/Wrapped' },
                hour:      { type: 'number', description: 'Scheduled hour (0-23) if time-specific' }
              },
              required: ['text', 'projectId']
            }
          }
        },
        required: ['tasks']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Add a single task directly to the task list',
      parameters: {
        type: 'object',
        properties: {
          text:      { type: 'string' },
          projectId: { type: 'string' },
          energy:    { type: 'string', description: '"high", "low", or omit' },
          stage:     { type: 'string' },
          hour:      { type: 'number' },
          domain:    { type: 'string', description: '"business" or "personal"' }
        },
        required: ['text', 'projectId']
      }
    }
  }
];

// ── System prompt builder ────────────────────────────────────────────────────

function buildBrainstormPrompt(taskTarget, todos, financial) {
  const activeTasks = todos.filter(t => !t.completed);
  const taskList = activeTasks.length
    ? activeTasks.map(t => `  [ID:${t.id}] ${t.text} | ${t.stage || 'Idea'} | project:${t.projectId || 'General'}`).join('\n')
    : '  (none)';

  const fin = financial || { clients: [], spotClients: [], accountBalance: 0 };
  const retainerTotal = (fin.clients || []).reduce((s, c) => s + c.amount, 0);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const focusBlock = taskTarget
    ? `\nFOCUSED TASK: "${taskTarget}"\nYour job is to help Sergiu think through this specific task — break it down, surface what's needed, and suggest sub-steps. When he's ready, call implement_plan to inject the agreed tasks.`
    : `\nThis is a general brainstorm session. Help Sergiu think through ideas, plan, and when ready, use implement_plan or add_task to inject agreed tasks.`;

  return `You are Jarvis — Sergiu's AI chief of staff running inside his Brainstorm panel.
TODAY: ${today}

${focusBlock}

━━ CURRENT TASKS (${activeTasks.length}) ━━
${taskList}

━━ FINANCES — target 20,000 RON/month ━━
  Retainers: ${retainerTotal.toLocaleString()} RON/month
  Cont firma: ${(fin.accountBalance || 0).toLocaleString()} RON

━━ RULES ━━
- Be sharp and creative. This is a thinking space, not just execution.
- Ask clarifying questions to help Sergiu think deeper.
- When a plan crystallises, call implement_plan immediately — don't just list tasks in text.
- Keep responses tight: max 4-5 sentences unless actively planning.
- Mix Romanian naturally (filmare, editare, ora, RON, etc.) when Sergiu does.
- High energy = creative/cognitive work. Low = admin, logistics.`;
}

// ── Hash color helper (same as rest of app) ──────────────────────────────────

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

// ── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'Break this into steps',
  'What do I need to start?',
  'What could go wrong?',
  'Estimate time for each step',
  'Implement this plan',
];

// ── Component ────────────────────────────────────────────────────────────────

const BrainstormChat = ({ isOpen, onClose, taskTarget, todos, setTodos, financial, onToolExecuted }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [implementedCount, setImplementedCount] = useState(0);
  const historyRef = useRef([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Reset on open / new task target
  useEffect(() => {
    if (isOpen) {
      historyRef.current = [];
      setImplementedCount(0);
      const greeting = taskTarget
        ? `Let's dig into **"${taskTarget}"**.\n\nWhat's the current status — is this already started, or are we planning from scratch?`
        : "Brainstorm mode. What are we thinking through?";
      setMessages([{ role: 'assistant', text: greeting }]);
    }
  }, [isOpen, taskTarget]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 350);
  }, [isOpen]);

  // ── Tool executor ──────────────────────────────────────────────────────────

  const executeTool = (name, args) => {
    if (name === 'implement_plan' || name === 'add_task') {
      const tasksToAdd = name === 'implement_plan'
        ? (args.tasks || [])
        : [args];

      const newTasks = tasksToAdd.map((t, i) => ({
        id: Date.now() + i + 1,
        text: t.text,
        completed: false,
        stage: t.stage || 'Idea',
        energy: t.energy === 'none' ? null : (t.energy || null),
        projectId: t.projectId || taskTarget || 'General',
        projectColor: hashProjectColor(t.projectId || taskTarget),
        domain: t.domain || 'business',
        hour: t.hour || null,
      }));

      setTodos(prev => [...newTasks, ...prev]);
      setImplementedCount(prev => prev + newTasks.length);

      if (onToolExecuted) {
        onToolExecuted(`✓ Jarvis: added ${newTasks.length} task${newTasks.length > 1 ? 's' : ''} from brainstorm`);
      }

      return { success: true, count: newTasks.length };
    }
    return { success: false, error: 'Unknown tool' };
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const send = async (text) => {
    if (!text.trim() || isLoading) return;
    setInput('');

    const userMsg = { role: 'user', content: text };
    historyRef.current = [...historyRef.current, userMsg];
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) throw new Error('Add VITE_GROQ_API_KEY to your environment variables');

      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

      const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: buildBrainstormPrompt(taskTarget, todos || [], financial) },
          ...historyRef.current
        ],
        tools: BRAINSTORM_TOOLS,
        tool_choice: 'auto',
        max_tokens: 1024
      });

      const assistantMsg = response.choices[0].message;
      historyRef.current = [...historyRef.current, assistantMsg];

      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        const toolMessages = [];
        let actionSummary = '';

        for (const toolCall of assistantMsg.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = executeTool(toolCall.function.name, args);
          if (toolCall.function.name === 'implement_plan') {
            actionSummary = `✓ ${result.count} tasks added to your list`;
          }
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        historyRef.current = [...historyRef.current, ...toolMessages];

        const followUp = await groq.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: buildBrainstormPrompt(taskTarget, todos || [], financial) },
            ...historyRef.current
          ],
          max_tokens: 512
        });

        const finalText = followUp.choices[0].message.content;
        historyRef.current = [...historyRef.current, { role: 'assistant', content: finalText }];
        setMessages(prev => [...prev, { role: 'assistant', text: finalText, actionSummary }]);

      } else {
        const txt = assistantMsg.content;
        historyRef.current = [...historyRef.current, { role: 'assistant', content: txt }];
        setMessages(prev => [...prev, { role: 'assistant', text: txt }]);
      }

    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full md:w-[420px] z-[110] flex flex-col bg-[#09090f]/96 backdrop-blur-2xl border-l border-white/8 shadow-2xl">

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pb-4 border-b border-white/8"
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
              <Sparkles size={17} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-none">Brainstorm</div>
              <div className="text-white/30 text-[10px] mt-0.5 leading-none truncate max-w-[200px]">
                {taskTarget ? `"${taskTarget}"` : 'Open session'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {implementedCount > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                ✓ {implementedCount} added
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white rounded-xl hover:bg-white/10 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-600/30 border border-indigo-500/25 text-white rounded-br-sm'
                    : 'bg-white/5 border border-white/8 text-white/90 rounded-bl-sm'
                }`}
              >
                <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>

                {/* Action chip */}
                {m.actionSummary && (
                  <div className="mt-2">
                    <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1.5 font-medium">
                      <Zap size={9} /> {m.actionSummary}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/8 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 size={13} className="text-indigo-400 animate-spin" />
                <span className="text-white/30 text-xs">thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        <div className="px-4 pt-1 pb-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {QUICK_PROMPTS.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={isLoading}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/8 text-indigo-300/70 hover:text-indigo-200 hover:bg-indigo-500/15 disabled:opacity-30 whitespace-nowrap transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div
          className="px-4 pt-2 border-t border-white/8"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder={taskTarget ? `Think through "${taskTarget.slice(0, 30)}..."` : 'What are we brainstorming?'}
              className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/40 transition-colors"
              style={{ fontSize: '16px' }}
            />
            <button
              onClick={() => send(input)}
              disabled={isLoading || !input.trim()}
              className="w-12 h-12 rounded-xl bg-indigo-600/35 border border-indigo-500/25 text-indigo-300 flex items-center justify-center hover:bg-indigo-600/55 disabled:opacity-30 flex-shrink-0 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BrainstormChat;

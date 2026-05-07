import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Loader2 } from 'lucide-react';
import Groq from 'groq-sdk';
import NotificationManager from '../utils/NotificationManager';

const MODEL = 'llama-3.3-70b-versatile';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Add a new task to the OS',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Task text' },
          energy: { type: 'string', description: '"high", "low", or omit' },
          projectId: { type: 'string', description: 'Client/project name' },
          stage: { type: 'string', description: 'Idea | Development | In Production | Paid/Wrapped' }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task as completed',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'number', description: 'Numeric task ID' }
        },
        required: ['taskId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task permanently',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'number' } },
        required: ['taskId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_task_energy',
      description: 'Set energy level of a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'number' },
          energy: { type: 'string', description: '"high", "low", or "none"' }
        },
        required: ['taskId', 'energy']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_task_stage',
      description: 'Set the stage of a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'number' },
          stage: { type: 'string' }
        },
        required: ['taskId', 'stage']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_invoice',
      description: 'Add a spot client invoice to the financial tracker',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number', description: 'Amount in RON' },
          status: { type: 'string', description: '"invoiced" or "paid"' }
        },
        required: ['name', 'amount', 'status']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mark_invoice_paid',
      description: 'Mark a spot client invoice as paid by client name',
      parameters: {
        type: 'object',
        properties: { clientName: { type: 'string' } },
        required: ['clientName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'schedule_reminder',
      description: 'Set a notification reminder for the user',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          minutesFromNow: { type: 'number' }
        },
        required: ['title', 'body', 'minutesFromNow']
      }
    }
  }
];

const ACTION_LABELS = {
  add_task: '+ task added',
  complete_task: '✓ completed',
  delete_task: '× deleted',
  set_task_energy: '⚡ energy set',
  set_task_stage: '◈ stage updated',
  add_invoice: '$ invoice added',
  mark_invoice_paid: '$ marked paid',
  schedule_reminder: '🔔 reminder set'
};

const QUICK_PROMPTS = [
  'Morning briefing',
  'What should I do first?',
  'How close am I to target?',
  "What's still invoiced?",
];

const getFinancial = () => {
  try { return JSON.parse(localStorage.getItem('sergiu_os_financial')) || { clients: [], spotClients: [] }; }
  catch { return { clients: [], spotClients: [] }; }
};

const saveFinancial = (data) => {
  try { localStorage.setItem('sergiu_os_financial', JSON.stringify(data)); } catch {}
};

function buildSystemPrompt(todos) {
  const active = todos.filter(t => !t.completed);
  const tasksStr = active.map(t =>
    `[ID:${t.id}] ${t.text} | ${t.stage || 'Idea'} | energy:${t.energy || 'none'} | ${t.projectId || 'General'}`
  ).join('\n') || 'none';

  const fin = getFinancial();
  const retainerTotal = (fin.clients || []).reduce((s, c) => s + c.amount, 0);
  const spotPaid = (fin.spotClients || []).filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const spotInvoiced = (fin.spotClients || []).filter(c => c.status === 'invoiced').reduce((s, c) => s + c.amount, 0);
  const collected = retainerTotal + spotPaid;
  const gap = Math.max(0, 20000 - collected - spotInvoiced);
  const invoicesStr = (fin.spotClients || []).map(c => `  ${c.name}: ${c.amount} RON (${c.status})`).join('\n') || '  none';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return `You are Jarvis — Sergiu's personal AI chief of staff. He runs a video production business in Romania (UGC, corporate video, events).

TODAY: ${today}

ACTIVE TASKS (${active.length} total):
${tasksStr}

FINANCES — May target: 20,000 RON:
- Retainers: ${retainerTotal.toLocaleString()} RON (Dabo 4,000 + Ramada 2,000 — always collected)
- Spot invoiced (pending): ${spotInvoiced.toLocaleString()} RON
- Spot paid: ${spotPaid.toLocaleString()} RON
- Total collected: ${collected.toLocaleString()} RON
- Gap to target: ${gap.toLocaleString()} RON
Invoices:
${invoicesStr}

RULES:
- Be direct. No fluff. Max 3 sentences unless doing a briefing.
- When asked to do something — use the tools, do it, confirm in one line.
- Morning briefing format: 1) Finance status 2) Top 3 tasks by priority 3) One risk or flag.
- Mix Romanian naturally (RON, ora, filmare, editare, etc.) when Sergiu does.
- High energy = cognitively demanding creative work. Low = admin, calls, pickups.`;
}

const JarvisAgent = ({ isOpen, onClose, todos, setTodos }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const historyRef = useRef([]); // OpenAI-style message history
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: 'assistant', text: 'Jarvis online. What do you need?' }]);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 350);
  }, [isOpen]);

  const executeTool = (name, args) => {
    switch (name) {
      case 'add_task': {
        const newId = Date.now();
        setTodos(prev => [{
          id: newId, text: args.text, completed: false,
          stage: args.stage || 'Idea',
          energy: args.energy === 'none' ? null : (args.energy || null),
          projectId: args.projectId || null, projectColor: null
        }, ...prev]);
        return { success: true, taskId: newId };
      }
      case 'complete_task':
        setTodos(prev => prev.map(t => t.id === args.taskId ? { ...t, completed: true } : t));
        return { success: true };
      case 'delete_task':
        setTodos(prev => prev.filter(t => t.id !== args.taskId));
        return { success: true };
      case 'set_task_energy': {
        const energy = args.energy === 'none' ? null : args.energy;
        setTodos(prev => prev.map(t => t.id === args.taskId ? { ...t, energy } : t));
        return { success: true };
      }
      case 'set_task_stage':
        setTodos(prev => prev.map(t => t.id === args.taskId ? { ...t, stage: args.stage } : t));
        return { success: true };
      case 'add_invoice': {
        const fin = getFinancial();
        saveFinancial({
          ...fin,
          spotClients: [...(fin.spotClients || []), {
            id: Date.now().toString(), name: args.name, amount: args.amount, status: args.status, type: 'spot'
          }]
        });
        return { success: true };
      }
      case 'mark_invoice_paid': {
        const fin = getFinancial();
        saveFinancial({
          ...fin,
          spotClients: (fin.spotClients || []).map(c =>
            c.name.toLowerCase().includes(args.clientName.toLowerCase()) ? { ...c, status: 'paid' } : c
          )
        });
        return { success: true };
      }
      case 'schedule_reminder': {
        const tag = `jarvis-reminder-${Date.now()}`;
        NotificationManager.scheduleCustom(args.title, args.body, args.minutesFromNow, tag);
        return { success: true };
      }
      default:
        return { success: false, error: 'Unknown tool' };
    }
  };

  const send = async (text) => {
    if (!text.trim() || isLoading) return;
    setInput('');

    const userMsg = { role: 'user', content: text };
    historyRef.current = [...historyRef.current, userMsg];
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) throw new Error('Add VITE_GROQ_API_KEY to Netlify env vars');

      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

      const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(todos) },
          ...historyRef.current
        ],
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 1024
      });

      const assistantMsg = response.choices[0].message;
      historyRef.current = [...historyRef.current, assistantMsg];

      // Handle tool calls
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        const actions = [];
        const toolMessages = [];

        for (const toolCall of assistantMsg.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = executeTool(toolCall.function.name, args);
          actions.push({ name: toolCall.function.name });
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        historyRef.current = [...historyRef.current, ...toolMessages];

        // Get final response after tool execution
        const followUp = await groq.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt(todos) },
            ...historyRef.current
          ],
          max_tokens: 512
        });

        const finalText = followUp.choices[0].message.content;
        historyRef.current = [...historyRef.current, { role: 'assistant', content: finalText }];
        setMessages(prev => [...prev, { role: 'assistant', text: finalText, actions }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: assistantMsg.content }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerBriefing = () => {
    historyRef.current = [];
    send('Morning briefing. Go.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#08080f]/97 backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-3 border-b border-white/8"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.5)]">
            <Sparkles size={17} className="text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-none">Jarvis</div>
            <div className="text-white/30 text-[10px] mt-0.5">Llama 3.3 70B · {todos.filter(t => !t.completed).length} tasks in context</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerBriefing}
            disabled={isLoading}
            className="text-[11px] font-medium px-3 py-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 active:bg-amber-500/30 disabled:opacity-40"
          >
            ☀️ Briefing
          </button>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-white/40 active:text-white rounded-xl active:bg-white/10">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user'
              ? 'bg-violet-600/35 border border-violet-500/30 text-white rounded-br-md'
              : 'bg-white/6 border border-white/10 text-white/90 rounded-bl-md'
              }`}>
              <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.actions.map((a, j) => (
                    <span key={j} className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20">
                      {ACTION_LABELS[a.name] || a.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/6 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 size={13} className="text-violet-400 animate-spin" />
              <span className="text-white/30 text-xs">thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 pt-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {QUICK_PROMPTS.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={isLoading}
            className="flex-shrink-0 text-[10px] px-3 py-1.5 rounded-lg bg-white/5 text-white/40 border border-white/10 active:bg-white/12 disabled:opacity-30 whitespace-nowrap"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pt-2 pb-6 border-t border-white/8 mt-2"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder="Tell Jarvis what to do..."
            className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={() => send(input)}
            disabled={isLoading || !input.trim()}
            className="w-12 h-12 rounded-xl bg-violet-600/40 border border-violet-500/30 text-violet-300 flex items-center justify-center active:bg-violet-600/60 disabled:opacity-30 flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default JarvisAgent;

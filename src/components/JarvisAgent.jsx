import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Loader2, Briefcase, User, RefreshCw } from 'lucide-react';
import Groq from 'groq-sdk';
import NotificationManager from '../utils/NotificationManager';

const MODEL = 'llama-3.3-70b-versatile';

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Add a new task. domain must be "business" or "personal".',
      parameters: {
        type: 'object',
        properties: {
          text:      { type: 'string', description: 'Task text' },
          domain:    { type: 'string', description: '"business" or "personal"' },
          energy:    { type: 'string', description: '"high", "low", or omit' },
          projectId: { type: 'string', description: 'Client or project name (business) or life area (personal)' },
          stage:     { type: 'string', description: 'Idea | Development | In Production | Paid/Wrapped' },
          hour:      { type: 'number', description: 'Scheduled hour (0-23) if time-specific' }
        },
        required: ['text', 'domain']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bulk_add_tasks',
      description: 'Add multiple tasks at once from a planning session. Use this when planning a day or a project.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            description: 'Array of tasks to add',
            items: {
              type: 'object',
              properties: {
                text:      { type: 'string' },
                domain:    { type: 'string', description: '"business" or "personal"' },
                energy:    { type: 'string' },
                projectId: { type: 'string' },
                stage:     { type: 'string' },
                hour:      { type: 'number' }
              },
              required: ['text', 'domain']
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
      name: 'update_task',
      description: 'Rename or change the text of an existing task',
      parameters: {
        type: 'object',
        properties: {
          taskId:  { type: 'number', description: 'Numeric task ID' },
          newText: { type: 'string', description: 'New task text' }
        },
        required: ['taskId', 'newText']
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
        properties: { taskId: { type: 'number' } },
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
      name: 'clear_completed',
      description: 'Remove all completed tasks to clean up the list',
      parameters: { type: 'object', properties: {} }
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
      description: 'Set the production stage of a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'number' },
          stage:  { type: 'string', description: 'Idea | Development | In Production | Paid/Wrapped' }
        },
        required: ['taskId', 'stage']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_task_project',
      description: 'Move a task to a different project/client',
      parameters: {
        type: 'object',
        properties: {
          taskId:    { type: 'number' },
          projectId: { type: 'string' }
        },
        required: ['taskId', 'projectId']
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
          name:   { type: 'string' },
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
      name: 'update_account_balance',
      description: 'Update the cont firma (company account) cash balance',
      parameters: {
        type: 'object',
        properties: { balance: { type: 'number', description: 'New balance in RON' } },
        required: ['balance']
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
          title:          { type: 'string' },
          body:           { type: 'string' },
          minutesFromNow: { type: 'number' }
        },
        required: ['title', 'body', 'minutesFromNow']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_task_hour',
      description: 'Reschedule a task to a specific hour of the day',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'number', description: 'Numeric task ID' },
          hour:   { type: 'number', description: 'Hour (0-23) to schedule the task, or null to remove time' }
        },
        required: ['taskId', 'hour']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_retainer',
      description: 'Update the monthly amount of an existing retainer client by name',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Name of the existing retainer client (e.g. "Dabo", "Ramada")' },
          amount:     { type: 'number', description: 'New monthly retainer amount in RON' }
        },
        required: ['clientName', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_retainer_client',
      description: 'Add a new recurring retainer client to the financial tracker',
      parameters: {
        type: 'object',
        properties: {
          name:         { type: 'string', description: 'Client name' },
          amount:       { type: 'number', description: 'Monthly retainer amount in RON' },
          deliverables: { type: 'string', description: 'What is delivered each month (optional)' }
        },
        required: ['name', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_invoice',
      description: 'Remove a spot invoice by client name',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Name of the spot client whose invoice to delete' }
        },
        required: ['clientName']
      }
    }
  }
];

// ─── Action Labels ─────────────────────────────────────────────────────────

const ACTION_LABELS = {
  add_task:               '+ task',
  bulk_add_tasks:         '+ bulk tasks',
  update_task:            '✎ updated',
  complete_task:          '✓ done',
  delete_task:            '× deleted',
  clear_completed:        '× cleared',
  set_task_energy:        '⚡ energy',
  set_task_stage:         '◈ stage',
  set_task_project:       '↳ moved',
  set_task_hour:          '🕐 rescheduled',
  add_invoice:            '$ invoice',
  mark_invoice_paid:      '$ paid',
  update_account_balance: '$ balance',
  update_retainer:        '$ retainer updated',
  add_retainer_client:    '$ new retainer',
  delete_invoice:         '$ invoice removed',
  schedule_reminder:      '🔔 reminder'
};

// ─── Quick Prompts ─────────────────────────────────────────────────────────

const QUICK_PROMPTS_BUSINESS = [
  'Morning briefing',
  'Just tell me what happened today',
  'What should I tackle first?',
  'How close am I to target?',
  "What's invoiced and pending?",
  'Plan my shoots this week',
];

const QUICK_PROMPTS_PERSONAL = [
  'What personal things need attention?',
  'Just tell me what happened today',
  'Schedule Elio pickup today',
  'Add gym to today',
  'Plan my evening',
];

// ─── Hash color ────────────────────────────────────────────────────────────

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

// ─── System Prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(todos, financial) {
  const businessTasks = todos.filter(t => !t.completed && t.domain === 'business');
  const personalTasks = todos.filter(t => !t.completed && t.domain === 'personal');
  const untaggedTasks = todos.filter(t => !t.completed && !t.domain);

  const fmtTask = t =>
    `  [ID:${t.id}] ${t.text} | ${t.stage || 'Idea'} | energy:${t.energy || 'none'} | project:${t.projectId || 'General'}${t.hour ? ` | ora ${t.hour}:00` : ''}`;

  const businessStr = businessTasks.length ? businessTasks.map(fmtTask).join('\n') : '  (none)';
  const personalStr = personalTasks.length ? personalTasks.map(fmtTask).join('\n') : '  (none)';
  const untaggedStr = untaggedTasks.length ? untaggedTasks.map(fmtTask).join('\n') : '  (none)';

  const fin = financial || { clients: [], spotClients: [], accountBalance: 0 };
  const retainerTotal = (fin.clients || []).reduce((s, c) => s + c.amount, 0);
  const spotPaid      = (fin.spotClients || []).filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const spotInvoiced  = (fin.spotClients || []).filter(c => c.status === 'invoiced').reduce((s, c) => s + c.amount, 0);
  const collected     = retainerTotal + spotPaid;
  const gap           = Math.max(0, 20000 - collected - spotInvoiced);
  const runway        = Math.floor(((fin.accountBalance || 0) / 17400) * 30);
  const invoicesStr   = (fin.spotClients || []).length
    ? (fin.spotClients || []).map(c => `  ${c.name}: ${c.amount.toLocaleString()} RON (${c.status})`).join('\n')
    : '  (none)';

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return `You are Jarvis — Sergiu's personal AI chief of staff. He runs a video production business in Romania (UGC, corporate, events). He also has a full personal life: son Elio (grădiniță pickup at 16:00), a relationship, health goals, and personal projects.

TODAY: ${today}

━━ BUSINESS TASKS (${businessTasks.length}) ━━
${businessStr}

━━ PERSONAL TASKS (${personalTasks.length}) ━━
${personalStr}

━━ UNTAGGED (${untaggedTasks.length}) ━━
${untaggedStr}

━━ FINANCES — target 20,000 RON/month ━━
  Retainers: ${retainerTotal.toLocaleString()} RON (Dabo 4,000 + Ramada 2,000 — always collected)
  Spot paid: ${spotPaid.toLocaleString()} RON
  Spot invoiced (pending): ${spotInvoiced.toLocaleString()} RON
  Total collected: ${collected.toLocaleString()} RON
  Gap to target: ${gap.toLocaleString()} RON
  Cont firma: ${(fin.accountBalance || 0).toLocaleString()} RON cash
  Runway: ~${runway} days (fixed costs 17,400 RON/month)
Invoices:
${invoicesStr}

━━ RULES ━━
- Be direct and sharp. No fluff. Max 3 sentences unless briefing or building a plan.
- When Sergiu asks you to PLAN something — use bulk_add_tasks immediately to populate his list. Don't just list tasks in text.
- Always tag new tasks: domain "business" (clients, shoots, edits, invoices, ops) or "personal" (Elio, health, home, relationship, admin).
- When financial things happen (invoice paid, balance update) — call the tool. Never just confirm in text.
- Morning briefing: 1) Finance snapshot 2) Top 3 business priorities 3) Personal flags 4) One risk or flag.
- Mix Romanian naturally when Sergiu does (filmare, editare, ora, RON, etc.).
- High energy = deep creative/cognitive work. Low = admin, calls, logistics, pickups.`;
}

// ─── Component ─────────────────────────────────────────────────────────────

const JarvisAgent = ({ isOpen, onClose, todos, setTodos, financial, setFinancial, onToolExecuted }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('business');
  const historyRef = useRef([]);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: 'assistant', text: 'Jarvis online. Business or personal — what do we work on?' }]);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 350);
  }, [isOpen]);

  // ── Tool Executor ────────────────────────────────────────────────────────

  const executeTool = (name, args) => {
    switch (name) {

      case 'add_task': {
        const newId = Date.now();
        setTodos(prev => [{
          id: newId,
          text: args.text,
          completed: false,
          stage: args.stage || 'Idea',
          energy: args.energy === 'none' ? null : (args.energy || null),
          projectId: args.projectId || null,
          projectColor: args.projectId ? hashProjectColor(args.projectId) : null,
          domain: args.domain || 'business',
          hour: args.hour || null,
        }, ...prev]);
        return { success: true, taskId: newId };
      }

      case 'bulk_add_tasks': {
        const newTasks = (args.tasks || []).map((t, i) => ({
          id: Date.now() + i + 1,
          text: t.text,
          completed: false,
          stage: t.stage || 'Idea',
          energy: t.energy === 'none' ? null : (t.energy || null),
          projectId: t.projectId || null,
          projectColor: t.projectId ? hashProjectColor(t.projectId) : null,
          domain: t.domain || 'business',
          hour: t.hour || null,
        }));
        setTodos(prev => [...newTasks, ...prev]);
        return { success: true, count: newTasks.length };
      }

      case 'update_task':
        setTodos(prev => prev.map(t => t.id === args.taskId ? { ...t, text: args.newText } : t));
        return { success: true };

      case 'complete_task':
        setTodos(prev => prev.map(t => t.id === args.taskId ? { ...t, completed: true } : t));
        return { success: true };

      case 'delete_task':
        setTodos(prev => prev.filter(t => t.id !== args.taskId));
        return { success: true };

      case 'clear_completed':
        setTodos(prev => prev.filter(t => !t.completed));
        return { success: true };

      case 'set_task_energy': {
        const energy = args.energy === 'none' ? null : args.energy;
        setTodos(prev => prev.map(t => t.id === args.taskId ? { ...t, energy } : t));
        return { success: true };
      }

      case 'set_task_stage':
        setTodos(prev => prev.map(t => t.id === args.taskId ? { ...t, stage: args.stage } : t));
        return { success: true };

      case 'set_task_project':
        setTodos(prev => prev.map(t => t.id === args.taskId ? {
          ...t,
          projectId: args.projectId,
          projectColor: hashProjectColor(args.projectId)
        } : t));
        return { success: true };

      case 'add_invoice': {
        if (!financial || !setFinancial) return { success: false, error: 'Financial state not connected' };
        setFinancial({
          ...financial,
          spotClients: [...(financial.spotClients || []), {
            id: Date.now().toString(),
            name: args.name,
            amount: args.amount,
            status: args.status,
            type: 'spot'
          }]
        });
        return { success: true };
      }

      case 'mark_invoice_paid': {
        if (!financial || !setFinancial) return { success: false, error: 'Financial state not connected' };
        setFinancial({
          ...financial,
          spotClients: (financial.spotClients || []).map(c =>
            c.name.toLowerCase().includes(args.clientName.toLowerCase()) ? { ...c, status: 'paid' } : c
          )
        });
        return { success: true };
      }

      case 'update_account_balance': {
        if (!financial || !setFinancial) return { success: false, error: 'Financial state not connected' };
        setFinancial({ ...financial, accountBalance: args.balance });
        return { success: true };
      }

      case 'schedule_reminder': {
        const tag = `jarvis-reminder-${Date.now()}`;
        NotificationManager.scheduleCustom(args.title, args.body, args.minutesFromNow, tag);
        return { success: true };
      }

      case 'set_task_hour':
        setTodos(prev => prev.map(t => t.id === args.taskId ? { ...t, hour: args.hour ?? null } : t));
        return { success: true };

      case 'update_retainer': {
        if (!financial || !setFinancial) return { success: false, error: 'Financial state not connected' };
        setFinancial({
          ...financial,
          clients: (financial.clients || []).map(c =>
            c.name.toLowerCase().includes(args.clientName.toLowerCase()) ? { ...c, amount: args.amount } : c
          )
        });
        return { success: true };
      }

      case 'add_retainer_client': {
        if (!financial || !setFinancial) return { success: false, error: 'Financial state not connected' };
        setFinancial({
          ...financial,
          clients: [...(financial.clients || []), {
            id: args.name.toLowerCase().replace(/\s+/g, '-'),
            name: args.name,
            amount: args.amount,
            type: 'retainer',
            status: 'active',
            deliverables: args.deliverables || ''
          }]
        });
        return { success: true };
      }

      case 'delete_invoice': {
        if (!financial || !setFinancial) return { success: false, error: 'Financial state not connected' };
        setFinancial({
          ...financial,
          spotClients: (financial.spotClients || []).filter(
            c => !c.name.toLowerCase().includes(args.clientName.toLowerCase())
          )
        });
        return { success: true };
      }

      default:
        return { success: false, error: 'Unknown tool' };
    }
  };

  // ── Send Message ─────────────────────────────────────────────────────────

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
          { role: 'system', content: buildSystemPrompt(todos, financial) },
          ...historyRef.current
        ],
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 1024
      });

      const assistantMsg = response.choices[0].message;
      historyRef.current = [...historyRef.current, assistantMsg];

      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        const actions = [];
        const toolMessages = [];

        for (const toolCall of assistantMsg.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = executeTool(toolCall.function.name, args);
          actions.push({ name: toolCall.function.name, args });
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        // Fire toast on the main screen
        if (onToolExecuted && actions.length > 0) {
          const summary = actions.map(a => {
            if (a.name === 'bulk_add_tasks') return `added ${a.args?.tasks?.length || ''} tasks`;
            if (a.name === 'add_task') return `added "${a.args?.text?.slice(0, 28)}${a.args?.text?.length > 28 ? '…' : ''}"` ;
            if (a.name === 'complete_task') return 'marked task done';
            if (a.name === 'add_invoice') return `logged invoice: ${a.args?.name} ${a.args?.amount} RON`;
            if (a.name === 'mark_invoice_paid') return `${a.args?.clientName} marked paid`;
            if (a.name === 'update_account_balance') return `balance → ${a.args?.balance?.toLocaleString()} RON`;
            if (a.name === 'add_retainer_client') return `new retainer: ${a.args?.name}`;
            if (a.name === 'update_retainer') return `${a.args?.clientName} retainer → ${a.args?.amount} RON`;
            if (a.name === 'set_task_hour') return `task rescheduled to ${a.args?.hour}:00`;
            if (a.name === 'delete_invoice') return `removed ${a.args?.clientName} invoice`;
            return ACTION_LABELS[a.name] || a.name;
          }).join(' · ');
          onToolExecuted(`✓ Jarvis: ${summary}`);
        }

        historyRef.current = [...historyRef.current, ...toolMessages];

        const followUp = await groq.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt(todos, financial) },
            ...historyRef.current
          ],
          max_tokens: 512
        });

        const finalText = followUp.choices[0].message.content;
        historyRef.current = [...historyRef.current, { role: 'assistant', content: finalText }];
        setMessages(prev => [...prev, { role: 'assistant', text: finalText, actions }]);

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

  const triggerBriefing = () => {
    historyRef.current = [];
    send('Morning briefing — business and personal. Give me the full picture.');
  };

  const resetConversation = () => {
    historyRef.current = [];
    setMessages([{ role: 'assistant', text: 'Conversation reset. Fresh start — what do you need?' }]);
  };

  if (!isOpen) return null;

  const businessCount = todos.filter(t => !t.completed && t.domain === 'business').length;
  const personalCount = todos.filter(t => !t.completed && t.domain === 'personal').length;
  const untaggedCount = todos.filter(t => !t.completed && !t.domain).length;
  const quickPrompts  = activeTab === 'business' ? QUICK_PROMPTS_BUSINESS : QUICK_PROMPTS_PERSONAL;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#07070e]/98 backdrop-blur-2xl">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-3 border-b border-white/8"
        style={{ paddingTop: 'max(18px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.5)] flex-shrink-0">
            <Sparkles size={17} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">Jarvis</div>
            <div className="text-white/30 text-[10px] mt-0.5 leading-none">
              {businessCount} business · {personalCount} personal{untaggedCount > 0 ? ` · ${untaggedCount} untagged` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={triggerBriefing}
            disabled={isLoading}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 active:bg-amber-500/30 disabled:opacity-40"
          >
            ☀️ Brief
          </button>
          <button
            onClick={resetConversation}
            className="w-8 h-8 flex items-center justify-center text-white/25 active:text-white/70 rounded-xl active:bg-white/8"
            title="Reset conversation"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/40 active:text-white rounded-xl active:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Business / Personal Toggle + untagged hint */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('business')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
            activeTab === 'business'
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              : 'text-white/30 border-white/8 bg-transparent'
          }`}
        >
          <Briefcase size={11} />
          Business
          {businessCount > 0 && (
            <span className={`text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold ${
              activeTab === 'business' ? 'bg-indigo-500/40 text-indigo-200' : 'bg-white/10 text-white/40'
            }`}>
              {businessCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
            activeTab === 'personal'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              : 'text-white/30 border-white/8 bg-transparent'
          }`}
        >
          <User size={11} />
          Personal
          {personalCount > 0 && (
            <span className={`text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold ${
              activeTab === 'personal' ? 'bg-cyan-500/40 text-cyan-200' : 'bg-white/10 text-white/40'
            }`}>
              {personalCount}
            </span>
          )}
        </button>

        {untaggedCount > 0 && (
          <button
            onClick={() => send(`I have ${untaggedCount} untagged tasks. Tag them all as business or personal based on context.`)}
            className="ml-auto text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors underline decoration-dotted"
          >
            {untaggedCount} untagged — fix
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-violet-600/30 border border-violet-500/25 text-white rounded-br-sm'
                  : 'bg-white/5 border border-white/8 text-white/90 rounded-bl-sm'
              }`}
            >
              <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>

              {/* Action chips */}
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.actions.map((a, j) => {
                    const isBiz = a.args?.domain === 'business' ||
                      ['add_invoice','mark_invoice_paid','update_account_balance'].includes(a.name);
                    const isPersonal = a.args?.domain === 'personal';
                    return (
                      <span
                        key={j}
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          isBiz
                            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20'
                            : isPersonal
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20'
                              : 'bg-violet-500/12 text-violet-300 border-violet-500/15'
                        }`}
                      >
                        {ACTION_LABELS[a.name] || a.name}
                        {a.name === 'bulk_add_tasks' && a.args?.tasks ? ` ×${a.args.tasks.length}` : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/8 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={13} className="text-violet-400 animate-spin" />
              <span className="text-white/30 text-xs">thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 pt-1 pb-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {quickPrompts.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={isLoading}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-xl border disabled:opacity-30 whitespace-nowrap transition-colors ${
              activeTab === 'business'
                ? 'bg-indigo-500/8 text-indigo-300/70 border-indigo-500/15 active:bg-indigo-500/20'
                : 'bg-cyan-500/8 text-cyan-300/70 border-cyan-500/15 active:bg-cyan-500/20'
            }`}
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
            placeholder={
              activeTab === 'business'
                ? 'Plan a shoot, log an invoice, update a stage...'
                : 'Schedule Elio pickup, add personal task...'
            }
            className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500/40 transition-colors"
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={() => send(input)}
            disabled={isLoading || !input.trim()}
            className="w-12 h-12 rounded-xl bg-violet-600/35 border border-violet-500/25 text-violet-300 flex items-center justify-center active:bg-violet-600/55 disabled:opacity-30 flex-shrink-0 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default JarvisAgent;

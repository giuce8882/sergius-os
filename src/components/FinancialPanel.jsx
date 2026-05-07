import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, Plus, X, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const RETAINERS = [
  { id: 'dabo', name: 'Dabo', amount: 4000, type: 'retainer', status: 'active', deliverables: '5 videos · 1 shoot day/month' },
  { id: 'ramada', name: 'Ramada', amount: 2000, type: 'retainer', status: 'active', deliverables: '4 videos · recurring' },
];

const FIXED_EXPENSES = [
  { id: 'credit_ing',       name: 'Credit ING Firmă',       amount: 1700, category: 'debt' },
  { id: 'contabila',        name: 'Contabilă',              amount: 600,  category: 'ops' },
  { id: 'hr',               name: 'HR',                     amount: 100,  category: 'ops' },
  { id: 'buget_stat',       name: 'Buget de stat',          amount: 1800, category: 'taxes' },
  { id: 'abonamente',       name: 'Abonamente & Servicii',  amount: 1000, category: 'ops' },
  { id: 'gradinita',        name: 'Grădinița Elio',         amount: 3600, category: 'personal' },
  { id: 'motorina',         name: 'Motorină',               amount: 2000, category: 'transport' },
  { id: 'alte',             name: 'Alte cheltuieli',        amount: 600,  category: 'other' },
  { id: 'credit_personal',  name: 'Card credit personal',   amount: 6000, category: 'debt' },
];

const CATEGORY_COLORS = {
  debt: 'text-red-400',
  taxes: 'text-orange-400',
  ops: 'text-blue-400',
  personal: 'text-violet-400',
  transport: 'text-amber-400',
  other: 'text-white/50',
};

const TARGET = 20000;
const TOTAL_EXPENSES = FIXED_EXPENSES.reduce((s, e) => s + e.amount, 0);

const DEFAULT_FINANCIAL = {
  clients: RETAINERS,
  spotClients: [],
  accountBalance: 11285,
};

const FinancialPanel = () => {
  const [financial, setFinancial] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newSpot, setNewSpot] = useState({ name: '', amount: '', status: 'invoiced' });
  const [showExpenses, setShowExpenses] = useState(false);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sergiu_os_financial');
      const parsed = saved ? JSON.parse(saved) : DEFAULT_FINANCIAL;
      if (parsed.accountBalance === undefined) parsed.accountBalance = 11285;
      setFinancial(parsed);
    } catch {
      setFinancial(DEFAULT_FINANCIAL);
    }
  }, []);

  const persist = (updated) => {
    setFinancial(updated);
    try { localStorage.setItem('sergiu_os_financial', JSON.stringify(updated)); } catch {}
  };

  if (!financial) return (
    <div className="animate-pulse text-white/30 text-sm text-center py-8">Loading finance...</div>
  );

  const retainerFloor = financial.clients.reduce((s, c) => s + c.amount, 0);
  const spotPaid = (financial.spotClients || []).filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const spotInvoiced = (financial.spotClients || []).filter(c => c.status === 'invoiced').reduce((s, c) => s + c.amount, 0);

  const collected = retainerFloor + spotPaid;
  const withPending = collected + spotInvoiced;
  const gap = TARGET - withPending;
  const pct = Math.min(100, Math.round((collected / TARGET) * 100));
  const pctWithPending = Math.min(100, Math.round((withPending / TARGET) * 100));

  const barColor = collected >= TARGET ? 'from-emerald-500 to-emerald-400' :
    collected >= TARGET * 0.6 ? 'from-amber-500 to-amber-400' : 'from-red-500 to-red-400';

  const balance = financial.accountBalance || 0;
  const netMonthly = TARGET - TOTAL_EXPENSES; // if target is hit
  const runwayDays = Math.floor((balance / TOTAL_EXPENSES) * 30);
  const runwayColor = runwayDays >= 30 ? 'text-emerald-400' : runwayDays >= 15 ? 'text-amber-400' : 'text-red-400';
  const runwayBg = runwayDays >= 30 ? 'bg-emerald-500/10 border-emerald-500/20' : runwayDays >= 15 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  const addSpot = () => {
    if (!newSpot.name.trim() || !newSpot.amount) return;
    const updated = {
      ...financial,
      spotClients: [...(financial.spotClients || []), {
        id: Date.now().toString(),
        name: newSpot.name.trim(),
        amount: parseFloat(newSpot.amount),
        status: newSpot.status,
        type: 'spot'
      }]
    };
    persist(updated);
    setNewSpot({ name: '', amount: '', status: 'invoiced' });
    setIsAdding(false);
  };

  const markPaid = (id) => persist({
    ...financial,
    spotClients: financial.spotClients.map(c => c.id === id ? { ...c, status: 'paid' } : c)
  });

  const removeSpot = (id) => persist({
    ...financial,
    spotClients: financial.spotClients.filter(c => c.id !== id)
  });

  const saveBalance = () => {
    const val = parseFloat(balanceDraft);
    if (!isNaN(val)) persist({ ...financial, accountBalance: val });
    setEditingBalance(false);
  };

  return (
    <div className="space-y-3">

      {/* ── Revenue Summary ── */}
      <div className="bg-black/30 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/50 text-xs font-medium uppercase tracking-wider">May Revenue</span>
          <span className="text-white/40 text-xs">/ {TARGET.toLocaleString()} RON</span>
        </div>

        <div className="flex items-end gap-2 mb-3">
          <span className={`text-3xl font-bold font-mono tabular-nums ${collected >= TARGET ? 'text-emerald-400' : collected >= TARGET * 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
            {collected.toLocaleString()}
          </span>
          <span className="text-white/40 text-sm mb-1">RON</span>
          {spotInvoiced > 0 && (
            <span className="text-amber-400/70 text-sm mb-1 font-mono">+{spotInvoiced.toLocaleString()} pending</span>
          )}
        </div>

        <div className="relative w-full bg-black/40 h-3 rounded-full overflow-hidden border border-white/5">
          <div className={`absolute left-0 top-0 h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
          {spotInvoiced > 0 && (
            <div className="absolute top-0 h-full bg-amber-400/30 rounded-full transition-all duration-700" style={{ left: `${pct}%`, width: `${pctWithPending - pct}%` }} />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-white/30 mt-1">
          <span>{pct}% collected</span>
          {gap > 0 ? <span className="text-red-400/70">{gap.toLocaleString()} RON gap</span> : <span className="text-emerald-400">Target hit!</span>}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="text-center bg-emerald-500/10 rounded-xl py-2 px-1 border border-emerald-500/20">
            <div className="text-emerald-400 font-bold font-mono text-xs tabular-nums">{retainerFloor.toLocaleString()}</div>
            <div className="text-white/40 text-[9px] mt-0.5">Retainers</div>
          </div>
          <div className="text-center bg-amber-500/10 rounded-xl py-2 px-1 border border-amber-500/20">
            <div className="text-amber-400 font-bold font-mono text-xs tabular-nums">{spotInvoiced.toLocaleString()}</div>
            <div className="text-white/40 text-[9px] mt-0.5">Invoiced</div>
          </div>
          <div className="text-center bg-blue-500/10 rounded-xl py-2 px-1 border border-blue-500/20">
            <div className="text-blue-400 font-bold font-mono text-xs tabular-nums">{spotPaid.toLocaleString()}</div>
            <div className="text-white/40 text-[9px] mt-0.5">Spot Paid</div>
          </div>
        </div>
      </div>

      {/* ── Cash Position ── */}
      <div className={`border rounded-2xl p-4 backdrop-blur-md ${runwayBg}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Cash Position</span>
          {runwayDays < 20 && <AlertTriangle size={13} className="text-red-400" />}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Balance */}
          <div className="text-center">
            <div className="text-[9px] text-white/30 mb-1">Cont Firmă</div>
            {editingBalance ? (
              <input
                autoFocus
                type="number"
                value={balanceDraft}
                onChange={e => setBalanceDraft(e.target.value)}
                onBlur={saveBalance}
                onKeyDown={e => e.key === 'Enter' && saveBalance()}
                className="w-full text-center bg-transparent border-b border-white/20 text-white text-xs font-mono outline-none tabular-nums"
              />
            ) : (
              <button
                onClick={() => { setBalanceDraft(String(balance)); setEditingBalance(true); }}
                className="text-white font-bold font-mono text-sm tabular-nums hover:text-white/70 transition-colors"
              >
                {balance.toLocaleString()}
              </button>
            )}
            <div className="text-[8px] text-white/25 mt-0.5">RON · tap to edit</div>
          </div>

          {/* Monthly out */}
          <div className="text-center">
            <div className="text-[9px] text-white/30 mb-1">Ieșiri / lună</div>
            <div className="text-red-400 font-bold font-mono text-sm tabular-nums">{TOTAL_EXPENSES.toLocaleString()}</div>
            <div className="text-[8px] text-white/25 mt-0.5">RON fix</div>
          </div>

          {/* Runway */}
          <div className="text-center">
            <div className="text-[9px] text-white/30 mb-1">Runway</div>
            <div className={`font-bold font-mono text-sm tabular-nums ${runwayColor}`}>{runwayDays}z</div>
            <div className="text-[8px] text-white/25 mt-0.5">zile acoperite</div>
          </div>
        </div>

        {/* Net if target hit */}
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${netMonthly >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <span className="text-[10px] text-white/40">Net dacă target e atins</span>
          <div className="flex items-center gap-1">
            {netMonthly >= 0 ? <TrendingUp size={11} className="text-emerald-400" /> : <TrendingDown size={11} className="text-red-400" />}
            <span className={`font-mono text-xs font-bold ${netMonthly >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netMonthly >= 0 ? '+' : ''}{netMonthly.toLocaleString()} RON
            </span>
          </div>
        </div>
      </div>

      {/* ── Expenses Breakdown (collapsible) ── */}
      <div className="bg-black/20 border border-white/8 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowExpenses(!showExpenses)}
          className="w-full flex items-center justify-between px-4 py-3 text-white/50 hover:text-white/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider">Cheltuieli fixe lunare</span>
            <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono">{TOTAL_EXPENSES.toLocaleString()} RON</span>
          </div>
          {showExpenses ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showExpenses && (
          <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-2">
            {FIXED_EXPENSES.map(exp => (
              <div key={exp.id} className="flex items-center justify-between py-1 px-2 rounded-xl hover:bg-white/3">
                <span className="text-white/70 text-xs">{exp.name}</span>
                <span className={`font-mono text-xs font-semibold tabular-nums ${CATEGORY_COLORS[exp.category]}`}>
                  {exp.amount.toLocaleString()} RON
                </span>
              </div>
            ))}
            <div className="border-t border-white/5 mt-2 pt-2 flex items-center justify-between px-2">
              <span className="text-white/40 text-[10px] uppercase tracking-wider">Total</span>
              <span className="text-red-400 font-mono text-sm font-bold tabular-nums">{TOTAL_EXPENSES.toLocaleString()} RON</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Retainer Clients ── */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-white/30 uppercase tracking-wider px-1">Retainers</div>
        {financial.clients.map(c => (
          <div key={c.id} className="flex items-center justify-between bg-black/20 border border-emerald-500/20 rounded-xl px-3 py-2">
            <div>
              <span className="text-white/90 text-sm font-medium">{c.name}</span>
              {c.deliverables && <div className="text-white/30 text-[10px]">{c.deliverables}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-xs tabular-nums">{c.amount.toLocaleString()} RON</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Spot Clients ── */}
      {(financial.spotClients || []).length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-white/30 uppercase tracking-wider px-1">Spot / One-off</div>
          {financial.spotClients.map(c => (
            <div key={c.id} className={`flex items-center justify-between bg-black/20 rounded-xl px-3 py-2 group border ${c.status === 'paid' ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
              <div>
                <span className="text-white/80 text-sm">{c.name}</span>
                <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full ${c.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {c.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/60 font-mono text-xs tabular-nums">{c.amount.toLocaleString()} RON</span>
                {c.status === 'invoiced' && (
                  <button onClick={() => markPaid(c.id)} className="text-emerald-400/50 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all" title="Mark paid">
                    <CheckCircle size={13} />
                  </button>
                )}
                <button onClick={() => removeSpot(c.id)} className="text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add spot client ── */}
      {isAdding ? (
        <div className="bg-black/30 border border-white/10 rounded-2xl p-3 space-y-2">
          <input
            autoFocus
            type="text"
            placeholder="Client name"
            value={newSpot.name}
            onChange={e => setNewSpot(p => ({ ...p, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addSpot()}
            className="w-full bg-transparent border-b border-white/10 text-white/80 text-sm py-1 outline-none placeholder-white/30"
          />
          <input
            type="number"
            placeholder="Amount (RON)"
            value={newSpot.amount}
            onChange={e => setNewSpot(p => ({ ...p, amount: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addSpot()}
            className="w-full bg-transparent border-b border-white/10 text-white/80 text-sm py-1 outline-none placeholder-white/30"
          />
          <select
            value={newSpot.status}
            onChange={e => setNewSpot(p => ({ ...p, status: e.target.value }))}
            className="bg-black/40 border border-white/10 text-white/60 text-xs rounded-lg px-2 py-1.5 outline-none w-full"
          >
            <option value="invoiced">Invoiced (waiting payment)</option>
            <option value="paid">Already paid</option>
          </select>
          <div className="flex gap-2 pt-1">
            <button onClick={addSpot} className="flex-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-xl py-1.5 hover:bg-emerald-500/30 transition-colors">Save</button>
            <button onClick={() => setIsAdding(false)} className="flex-1 bg-white/5 text-white/40 text-xs rounded-xl py-1.5 hover:bg-white/10 transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 text-xs text-white/30 hover:text-white/60 py-2.5 border border-dashed border-white/10 hover:border-white/20 rounded-xl transition-all"
        >
          <Plus size={12} /> Add invoice / spot client
        </button>
      )}
    </div>
  );
};

export default FinancialPanel;

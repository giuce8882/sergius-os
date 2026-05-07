import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import NotificationManager from '../utils/NotificationManager';

const NotificationBanner = ({ todos, onGranted }) => {
  const [status, setStatus] = useState('idle'); // idle | asking | granted | denied | unsupported
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!NotificationManager.supported) { setStatus('unsupported'); return; }
    const perm = NotificationManager.permission;
    if (perm === 'granted') { setStatus('granted'); onGranted?.(); return; }
    if (perm === 'denied') { setStatus('denied'); return; }

    // Show banner after 3 seconds if not yet asked
    const wasDismissed = localStorage.getItem('sergiu_os_notif_dismissed');
    if (wasDismissed) { setDismissed(true); return; }
    setStatus('prompt');
  }, []);

  const handleEnable = async () => {
    setStatus('asking');
    const result = await NotificationManager.requestPermission();
    setStatus(result);
    if (result === 'granted') {
      await NotificationManager.init(todos);
      onGranted?.();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('sergiu_os_notif_dismissed', '1');
  };

  if (dismissed || status === 'idle' || status === 'unsupported' || status === 'granted') return null;

  if (status === 'denied') return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3 text-xs text-red-400">
      <BellOff size={13} />
      <span>Notifications blocked in browser settings.</span>
    </div>
  );

  return (
    <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/25 rounded-xl px-3 py-2.5 mb-3 animate-fade-in">
      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
        <Bell size={15} className="text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-xs font-medium leading-tight">Enable reminders</p>
        <p className="text-white/40 text-[10px] leading-tight mt-0.5">Task alarms · morning briefing · Jarvis alerts</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleEnable}
          disabled={status === 'asking'}
          className="px-3 py-1.5 rounded-lg bg-violet-500/30 text-violet-300 text-[11px] font-semibold border border-violet-500/30 active:bg-violet-500/50 disabled:opacity-50"
        >
          {status === 'asking' ? '...' : 'Enable'}
        </button>
        <button onClick={handleDismiss} className="p-1.5 text-white/20 active:text-white/50 rounded-lg">
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

export default NotificationBanner;

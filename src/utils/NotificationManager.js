// Handles all notification scheduling for Sergiu OS
// Works in-app (foreground) + service worker (backgrounded)

const STORAGE_KEY = 'sergiu_os_scheduled_notifs';

class NotificationManager {
  static get supported() {
    return 'Notification' in window;
  }

  static get permission() {
    return this.supported ? Notification.permission : 'unsupported';
  }

  static get canNotify() {
    return this.permission === 'granted';
  }

  static async requestPermission() {
    if (!this.supported) return 'unsupported';
    if (this.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  }

  static async getServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
  }

  // Show a notification immediately
  static async show(title, body, tag = 'sergiu-os') {
    if (!this.canNotify) return;
    const sw = await this.getServiceWorker();
    if (sw?.active) {
      sw.active.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag });
    } else {
      new Notification(title, { body, icon: '/pwa-icon-512.png', tag });
    }
  }

  // Schedule notification via SW (survives when app is backgrounded)
  static async scheduleViaServiceWorker(title, body, tag, delayMs) {
    const sw = await this.getServiceWorker();
    if (sw?.active) {
      sw.active.postMessage({ type: 'SCHEDULE_NOTIFICATION', title, body, tag, delayMs });
      return true;
    }
    // Fallback: setTimeout in main thread (only while app is open)
    setTimeout(() => this.show(title, body, tag), delayMs);
    return false;
  }

  // Persist a scheduled notification to localStorage so we can fire it on next open if missed
  static saveScheduled(id, title, body, fireAt) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = existing.filter(n => n.id !== id);
      filtered.push({ id, title, body, fireAt });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {}
  }

  static clearScheduled(id) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(n => n.id !== id)));
    } catch {}
  }

  // On app load: fire any notifications that were due while app was closed
  static async flushOverdue() {
    if (!this.canNotify) return;
    try {
      const now = Date.now();
      const scheduled = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const overdue = scheduled.filter(n => n.fireAt <= now);
      const future = scheduled.filter(n => n.fireAt > now);

      for (const n of overdue) {
        await this.show(n.title, n.body, n.id);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(future));
    } catch {}
  }

  // Schedule alerts for all tasks that have "ora X" or "at X"
  static async scheduleTaskAlerts(todos) {
    if (!this.canNotify) return;

    const now = new Date();
    const todayStr = now.toDateString();

    for (const task of todos) {
      if (task.completed) continue;
      const match = task.text.toLowerCase().match(/(?:ora|at)\s*(\d{1,2})/);
      if (!match) continue;

      const taskHour = parseInt(match[1]);
      const target30 = new Date();
      target30.setHours(taskHour, 0, 0, 0);
      target30.setMinutes(-30); // 30 min before

      const delayMs30 = target30.getTime() - now.getTime();
      const delayMs0 = (target30.getTime() + 30 * 60 * 1000) - now.getTime();

      // 30 minutes before
      if (delayMs30 > 0 && delayMs30 < 12 * 60 * 60 * 1000) {
        const tag = `task-30min-${task.id}`;
        this.saveScheduled(tag, `⏰ In 30 min: ${task.text}`, 'Tap to open Sergiu OS', target30.getTime());
        this.scheduleViaServiceWorker(`⏰ In 30 min`, task.text, tag, delayMs30);
      }

      // Exactly at task time
      if (delayMs0 > 0 && delayMs0 < 12 * 60 * 60 * 1000) {
        const tag = `task-now-${task.id}`;
        const fireAt = target30.getTime() + 30 * 60 * 1000;
        this.saveScheduled(tag, `🔴 Now: ${task.text}`, 'Time to start!', fireAt);
        this.scheduleViaServiceWorker(`🔴 Now: ${task.text}`, 'Time to start!', tag, delayMs0);
      }
    }
  }

  // Daily 9 AM morning briefing notification
  static scheduleMorningBriefing() {
    if (!this.canNotify) return;

    const now = new Date();
    const target = new Date();
    target.setHours(9, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const delay = target.getTime() - now.getTime();
    const tag = 'morning-briefing';

    this.saveScheduled(tag, '☀️ Morning Briefing', 'Open Jarvis → tap Briefing to start your day', target.getTime());
    this.scheduleViaServiceWorker('☀️ Morning Briefing', 'Open Jarvis → tap Briefing to start your day', tag, delay);

    // Reschedule after firing
    setTimeout(() => this.scheduleMorningBriefing(), delay + 1000);
  }

  // Jarvis can call this to schedule a custom reminder
  static async scheduleCustom(title, body, minutesFromNow, tag) {
    if (!this.canNotify) return false;
    const fireAt = Date.now() + minutesFromNow * 60 * 1000;
    this.saveScheduled(tag, title, body, fireAt);
    await this.scheduleViaServiceWorker(title, body, tag, minutesFromNow * 60 * 1000);
    return true;
  }

  // Call this once on app boot
  static async init(todos) {
    await this.flushOverdue();
    if (this.canNotify) {
      await this.scheduleTaskAlerts(todos);
      this.scheduleMorningBriefing();
    }
  }
}

export default NotificationManager;

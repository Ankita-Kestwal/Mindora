/* Theme + font preferences.
 *
 * Automatic mode is TIMED: the theme flips dark ↔ light every `autoIntervalMin`
 * minutes. It is wall-clock based (lastSwitchAt), so the countdown carries over
 * page reloads and tabs. A manual toggle in auto mode switches immediately and
 * restarts the countdown. This is not OS dark-mode detection.
 */
const KEY = 'mindora.prefs';

export const FONTS = [
  { id: 'inter', label: 'Inter', note: 'Clean, neutral (default)' },
  { id: 'poppins', label: 'Poppins', note: 'Geometric, friendly' },
  { id: 'sora', label: 'Sora', note: 'Modern, technical' },
  { id: 'ibm-plex-sans', label: 'IBM Plex Sans', note: 'Professional, crisp' },
  { id: 'lexend', label: 'Lexend', note: 'Designed for easy reading' },
  { id: 'source-serif', label: 'Source Serif 4', note: 'Serif, book-like' },
];
export const DEFAULTS = { theme: 'dark', autoTheme: false, autoIntervalMin: 5, font: 'inter', lastSwitchAt: Date.now() };

export function loadLocal() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveLocal(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

/** Resolves elapsed auto-switch intervals. Returns a new prefs object. */
export function resolveAuto(p, now = Date.now()) {
  if (!p.autoTheme || !(p.autoIntervalMin > 0)) return p;
  const ms = p.autoIntervalMin * 60000;
  const periods = Math.floor((now - (p.lastSwitchAt || now)) / ms);
  if (periods <= 0) return p;
  return {
    ...p,
    theme: periods % 2 === 1 ? (p.theme === 'dark' ? 'light' : 'dark') : p.theme,
    lastSwitchAt: p.lastSwitchAt + periods * ms,
  };
}

export function secondsToNextSwitch(p, now = Date.now()) {
  if (!p.autoTheme) return null;
  return Math.max(0, Math.ceil((p.lastSwitchAt + p.autoIntervalMin * 60000 - now) / 1000));
}

export function applyToDocument(p, animate = true) {
  const html = document.documentElement;
  if (html.getAttribute('data-theme') !== p.theme) {
    if (animate) { html.classList.add('theme-anim'); setTimeout(() => html.classList.remove('theme-anim'), 450); }
    html.setAttribute('data-theme', p.theme);
  }
  html.setAttribute('data-font', p.font);
}

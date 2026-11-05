import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadLocal, saveLocal, resolveAuto, applyToDocument, secondsToNextSwitch } from '../lib/theme.js';
import { api } from '../lib/api.js';

const PrefsContext = createContext(null);
const SERVER_KEYS = ['theme', 'autoTheme', 'autoIntervalMin', 'font'];

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(() => resolveAuto(loadLocal()));
  const [now, setNow] = useState(Date.now());
  const syncToServer = useRef(false); // true once a signed-in profile is loaded

  // Apply + persist whenever prefs change.
  useEffect(() => { applyToDocument(prefs); saveLocal(prefs); }, [prefs]);

  // Timer: resolve auto-switches every second (also drives the countdown display).
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setPrefs((p) => { const n = resolveAuto(p); return n === p ? p : n; });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === 'mindora.prefs') setPrefs(resolveAuto(loadLocal())); };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, []);

  const push = useCallback((patch) => {
    if (!syncToServer.current) return;
    const body = Object.fromEntries(Object.entries(patch).filter(([k]) => SERVER_KEYS.includes(k)));
    if (Object.keys(body).length) api('/me/prefs', { method: 'PUT', body }).catch((e) => console.warn('[prefs] not saved to account:', e.message));
  }, []);

  const update = useCallback((patch, { restartTimer = false } = {}) => {
    setPrefs((p) => ({ ...p, ...patch, ...(restartTimer ? { lastSwitchAt: Date.now() } : {}) }));
    push(patch);
  }, [push]);

  const toggleTheme = useCallback(() => {
    setPrefs((p) => {
      const theme = p.theme === 'dark' ? 'light' : 'dark';
      push({ theme });
      return { ...p, theme, lastSwitchAt: Date.now() };
    });
  }, [push]);

  /** Called when the signed-in profile loads: the account's prefs win. */
  const adoptServerPrefs = useCallback((server) => {
    syncToServer.current = true;
    if (!server) return;
    setPrefs((p) => {
      // In automatic mode the current theme is driven by the timer, so keep this
      // device's running theme and countdown instead of resetting it to the saved one.
      const timed = server.autoTheme && p.autoTheme && p.autoIntervalMin === server.autoIntervalMin;
      const keys = timed ? SERVER_KEYS.filter((k) => k !== 'theme') : SERVER_KEYS;
      if (keys.every((k) => p[k] === server[k])) return p;
      return timed ? { ...p, ...server, theme: p.theme } : { ...p, ...server, lastSwitchAt: Date.now() };
    });
  }, []);
  const detach = useCallback(() => { syncToServer.current = false; }, []);

  return (
    <PrefsContext.Provider value={{ prefs, update, toggleTheme, adoptServerPrefs, detach, secondsLeft: secondsToNextSwitch(prefs, now) }}>
      {children}
    </PrefsContext.Provider>
  );
}

export const usePrefs = () => useContext(PrefsContext);

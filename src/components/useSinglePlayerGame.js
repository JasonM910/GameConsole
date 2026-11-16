import { useCallback, useEffect, useRef, useState } from 'react';
import { collectGameEvents } from '../services/gameEvents.js';

export function useSinglePlayerGame(Model, { record, adapter, onSave, onEvents }) {
  const [match] = useState(() => {
    const restored = Model.fromJSON(record);
    restored.pause();
    return restored;
  });
  const [, render] = useState(0);
  const [error, setError] = useState('');
  const callbacks = useRef({ onSave, onEvents });
  callbacks.current = { onSave, onEvents };
  const commit = useCallback(() => {
    try {
      const events = collectGameEvents(match, adapter);
      callbacks.current.onSave(match.toJSON());
      if (events.length) void callbacks.current.onEvents(events);
      setError('');
    } catch (failure) {
      match.pause();
      setError(failure.message);
    }
    render((value) => value + 1);
  }, [match, adapter]);

  useEffect(() => {
    commit();
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(250, now - previous);
      previous = now;
      if (match.status !== 'in-progress') return;
      match.tick(delta);
      commit();
    }, 100);
    const pause = () => { match.pause(); commit(); };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      match.pause();
      try { callbacks.current.onSave(match.toJSON()); } catch {
        // App conserva el error de almacenamiento; no interrumpir el desmontaje.
      }
    };
  }, [match, commit]);

  return { match, commit, error, act: (action) => { action(match); commit(); } };
}

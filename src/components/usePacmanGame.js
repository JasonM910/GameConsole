import { useCallback, useEffect, useRef, useState } from 'react';
import { PacmanMatch } from '../games/pacman/PacmanMatch.js';
import { collectGameEvents } from '../services/gameEvents.js';

// La simulación usa el reloj de animación. React y el almacenamiento tienen una frecuencia menor.
export function usePacmanGame({ record, adapter, onSave, onEvents, onGameEvents }) {
  const [match] = useState(() => { const restored = PacmanMatch.fromJSON(record); restored.pause(); return restored; });
  const [, render] = useState(0);
  const [error, setError] = useState('');
  const callbacks = useRef({ onSave, onEvents, onGameEvents });
  callbacks.current = { onSave, onEvents, onGameEvents };

  const save = useCallback(() => {
    try {
      const events = collectGameEvents(match, adapter);
      callbacks.current.onSave(match.toJSON());
      if (events.length) {
        void callbacks.current.onEvents(events);
        callbacks.current.onGameEvents?.(events);
      }
      setError('');
    } catch (failure) { match.pause(); setError(failure.message); }
  }, [match, adapter]);

  const commit = useCallback(() => { save(); render((value) => value + 1); }, [save]);
  useEffect(() => {
    let previous = performance.now();
    let sinceSave = 0;
    let sinceRender = 0;
    let frame;
    commit();
    function animate(now) {
      const delta = Math.min(100, Math.max(0, now - previous));
      previous = now;
      if (match.status === 'in-progress') {
        match.tick(delta);
        sinceSave += delta; sinceRender += delta;
        if (match.pendingEvents.length || sinceSave >= 500) { save(); sinceSave = 0; }
        if (sinceRender >= 100 || match.status === 'finished') { render((value) => value + 1); sinceRender = 0; }
      }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    const pause = () => { match.pause(); commit(); };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pause);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pause);
      match.pause();
      try { callbacks.current.onSave(match.toJSON()); } catch { /* App muestra el error de persistencia. */ }
    };
  }, [match, commit, save]);

  return { match, error, commit, act: (action) => { action(match); commit(); } };
}

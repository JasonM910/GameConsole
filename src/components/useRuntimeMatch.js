import { useCallback, useEffect, useSyncExternalStore } from 'react';

export function useRuntimeMatch({ runtime, record, onGameEvents }) {
  const id = record.id;
  const entry = runtime.entries.get(id);
  const subscribe = useCallback((listener) => runtime.subscribe(id, listener), [runtime, id]);
  useSyncExternalStore(subscribe, () => entry.version);
  useEffect(() => {
    if (!onGameEvents) return;
    entry.eventListeners.add(onGameEvents);
    return () => entry.eventListeners.delete(onGameEvents);
  }, [entry, onGameEvents]);
  const commit = useCallback(() => runtime.commit(id), [runtime, id]);
  const act = useCallback((action) => runtime.act(id, action), [runtime, id]);
  return { match: entry.model, error: entry.error, readOnly: !entry.owned, commit, act,
    aiStatus: entry.aiStatus, aiInfo: entry.aiInfo };
}

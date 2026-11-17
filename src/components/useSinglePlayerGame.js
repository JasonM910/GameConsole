import { useRuntimeMatch } from './useRuntimeMatch.js';

export function useSinglePlayerGame(_Model, props) {
  return useRuntimeMatch(props);
}

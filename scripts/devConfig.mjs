export function gameStatsTarget(env = {}) {
  return env.GAMESTATS_PROXY_TARGET?.trim() || `http://127.0.0.1:${env.GAMECONSOLE_PORT || '8088'}`;
}

export function prologTarget(env = {}) {
  const compose = `http://127.0.0.1:${env.GAMECONSOLE_PORT || '8088'}`;
  return env.PROLOG_PROXY_TARGET?.trim() || (gameStatsTarget(env) === compose ? compose : 'http://127.0.0.1:8082');
}

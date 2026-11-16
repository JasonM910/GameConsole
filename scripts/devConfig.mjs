export function gameStatsTarget(env = {}) {
  return env.GAMESTATS_PROXY_TARGET?.trim() || `http://127.0.0.1:${env.GAMECONSOLE_PORT || '8088'}`;
}

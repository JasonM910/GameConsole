import { useEffect, useState } from 'react';
import { fetchStats } from '../services/statsClient.js';

const GAME_NAMES = { CHESS: 'Ajedrez', PACMAN: 'Pac-Man', MEMORY: 'Memoria', MINESWEEPER: 'Buscaminas' };
const RESULTS = { WIN: 'Victoria', LOSS: 'Derrota', DRAW: 'Empate', DECIDED: 'Decidida', UNFINISHED: 'En curso' };
const METRICS = { totalPoints: 'Puntos', pointsPerMinute: 'Puntos/min', pairsFound: 'Parejas', matchAccuracyPercent: 'Aciertos (%)', timeUsedPercent: 'Tiempo usado (%)', movesPlayed: 'Jugadas', avgThinkTimeSeconds: 'Reflexión media (s)', capturedMaterial: 'Material capturado', checksGiven: 'Jaques', flagAccuracyPercent: 'Banderas correctas (%)', cellsRevealed: 'Casillas reveladas' };
const number = (value) => new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(value);

export default function StatisticsPanel({ onSync, delivery }) {
  const [filters, setFilters] = useState({ gameId: '', playerId: '' });
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  useEffect(() => {
    let disposed = false;
    let active;
    async function refresh() {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      const timeout = setTimeout(() => controller.abort(new Error('GameStats tardó demasiado en responder')), 20000);
      setState((current) => ({ ...current, loading: true }));
      try {
        const data = await fetchStats({ ...filters, signal: controller.signal });
        if (!disposed && active === controller) setState({ data, loading: false, error: '' });
      } catch (error) {
        if (!disposed && active === controller) setState((current) => ({ ...current, loading: false, error: error.message }));
      } finally { clearTimeout(timeout); }
    }
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => { disposed = true; clearInterval(timer); active?.abort(); };
  }, [filters, revision]);

  const { data, loading, error } = state;
  return (
    <section className="statistics-panel" aria-labelledby="stats-title">
      <div className="section-heading"><div><p className="eyebrow">Resultados de GameStats</p><h1 id="stats-title">Estadísticas</h1></div><button className="button button--quiet" onClick={async () => { await onSync(); setRevision((value) => value + 1); }} type="button">Sincronizar y actualizar</button></div>
      <form className="stats-filters" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        setFilters({ gameId: form.get('gameId'), playerId: form.get('playerId').trim() });
      }}>
        <div className="stats-filter-field"><label htmlFor="stats-game">Juego</label><select id="stats-game" name="gameId" defaultValue=""><option value="">Todos los juegos</option>{Object.entries(GAME_NAMES).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></div>
        <div className="stats-filter-field"><label htmlFor="stats-player">Identificador del jugador</label><input id="stats-player" name="playerId" placeholder="Todos los jugadores" /></div>
        <button className="button button--primary" type="submit">Consultar</button>
      </form>
      <p className="arcade-help">Actualización cada 10 segundos. {delivery.message} El filtro de jugador muestra sus partidas con todos sus participantes.</p>
      {loading && <p role="status">Consultando GameStats…</p>}
      {error && <p role="alert" className="form-error">{error} Puedes volver a intentar con «Sincronizar y actualizar». {data && 'Se muestran los últimos resultados recibidos.'}</p>}
      {data && !data.matches.length && <div className="empty-sessions"><p>No hay estadísticas para estos filtros. Juega una partida y sincroniza sus eventos.</p></div>}
      {data && data.matches.length > 0 && <>
        <div className="stats-grid">{data.players.map((player) => <article className="side-card" key={player.playerId}><h2>{player.playerId}</h2><div className="side-stat"><span>Partidas finalizadas</span><strong>{player.matchesPlayed}</strong></div><div className="side-stat"><span>Victorias / Derrotas / Empates</span><strong>{player.wins} / {player.losses} / {player.draws}</strong></div><div className="side-stat"><span>Victorias (%)</span><strong>{number(player.winrate)}</strong></div></article>)}</div>
        <div className="stats-grid">{data.games.map((game) => <article key={game.gameId} className="side-card"><h2>{GAME_NAMES[game.gameId] ?? game.gameId}</h2><div className="side-stat"><span>Partidas registradas</span><strong>{game.matches}</strong></div><div className="side-stat"><span>Eventos</span><strong>{game.eventCount}</strong></div><div className="side-stat"><span>Duración media finalizadas (s)</span><strong>{number(game.avgDurationSeconds)}</strong></div></article>)}</div>
        <h2>Historial de partidas</h2>
        <div className="stats-table-wrap"><table className="stats-table"><thead><tr><th>Partida</th><th>Juego</th><th>Jugador y resultado</th><th>Estado</th><th>Duración</th><th>Indicadores</th></tr></thead><tbody>{data.matches.map((match) => <tr key={match.matchId}><td title={match.matchId}>{match.matchId.slice(0, 8)}</td><td>{GAME_NAMES[match.gameId] ?? match.gameId}</td><td>{match.players.map((id) => <div key={id}>{id}: {RESULTS[match.results.find((result) => result.playerId === id)?.result] ?? 'En curso'}</div>)}</td><td>{RESULTS[match.result] ?? match.result}</td><td>{match.durationSeconds} s</td><td>{data.metrics.filter((metric) => metric.matchId === match.matchId).map((metric) => <div key={`${metric.playerId}:${metric.metric}`}>{metric.playerId} · {METRICS[metric.metric] ?? metric.metric}: <strong>{number(metric.value)}</strong></div>)}</td></tr>)}</tbody></table></div>
        {data.patterns.length > 0 && <><h2>Patrones detectados</h2><div className="stats-grid">{data.patterns.map((pattern) => <article className="side-card" key={`${pattern.pattern}:${pattern.startEventId}:${pattern.endEventId}`}><strong>{pattern.playerId} · {pattern.pattern}</strong><p>{pattern.description}</p><small>Partida {pattern.matchId.slice(0, 8)}</small></article>)}</div></>}
      </>}
    </section>
  );
}

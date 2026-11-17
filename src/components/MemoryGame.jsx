import { MemoryMatch } from '../games/memory/MemoryMatch.js';
import ArcadeLayout from './ArcadeLayout.jsx';
import { useSinglePlayerGame } from './useSinglePlayerGame.js';

export default function MemoryGame(props) {
  const { match, act, error, readOnly } = useSinglePlayerGame(MemoryMatch, props);
  function restart() {
    if (match.status !== 'ready' && match.status !== 'finished') act((game) => game.end('LOSS'));
    props.onRestart('MEMORY');
  }
  return (
    <ArcadeLayout {...props} title="Memoria" match={match} error={error} readOnly={readOnly} onRestart={restart}
      help={<p className="arcade-help">Encuentra las ocho parejas antes de que termine el tiempo. Voltea dos cartas por intento; las parejas encontradas permanecen visibles.</p>}
      onToggle={() => act((game) => game.status === 'ready' ? game.start() : game.status === 'paused' ? game.resume() : game.pause())}
      summary={<><div className="side-stat"><span>Parejas encontradas</span><strong>{match.pairsFound} / {match.pairCount}</strong></div><div className="side-stat"><span>Intentos</span><strong>{match.attempts}</strong></div><div className="side-stat"><span>Tiempo restante</span><strong>{match.remainingSeconds} s</strong></div></>}>
      <div className="memory-board" style={{ gridTemplateColumns: `repeat(${match.columns}, 1fr)` }} aria-label="Tablero de Memoria">
        {match.cards.map((card, index) => {
          const visible = card.matched || match.selected.includes(card.id);
          return <button key={card.id} type="button" className={`memory-card${visible ? ' is-revealed' : ''}${card.matched ? ' is-matched' : ''}`}
            aria-label={`Carta ${index + 1}: ${visible ? card.symbol : 'oculta'}${card.matched ? ', pareja encontrada' : ''}`}
            aria-pressed={visible} disabled={readOnly || match.status !== 'in-progress' || card.matched || match.selected.includes(card.id) || match.selected.length === 2}
            onClick={() => act((game) => game.flip(card.id))}><span aria-hidden="true">{visible ? card.symbol : '?'}</span>{card.matched && <small>✓</small>}</button>;
        })}
      </div>
    </ArcadeLayout>
  );
}

import { useEffect } from 'react';
import { PacmanMatch } from '../games/pacman/PacmanMatch.js';
import { positionKey, samePosition } from '../games/pacman/Maze.js';
import ArcadeLayout from './ArcadeLayout.jsx';
import { useSinglePlayerGame } from './useSinglePlayerGame.js';

const KEYS = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };

export default function PacmanGame(props) {
  const { match, commit, act, error } = useSinglePlayerGame(PacmanMatch, props);
  useEffect(() => {
    function keydown(event) {
      if (/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      const direction = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
      if (direction) { event.preventDefault(); match.setDirection(direction); }
      if (event.code === 'Space' && event.target.tagName !== 'BUTTON') {
        event.preventDefault();
        if (match.status === 'in-progress') match.pause();
        else if (match.status === 'ready') match.start();
        else match.resume();
        commit();
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [match, commit]);

  function restart() {
    if (match.status !== 'ready' && match.status !== 'finished') act((game) => game.end('LOSS'));
    props.onRestart('PACMAN');
  }

  return (
    <ArcadeLayout {...props} title="Pac-Man" match={match} error={error} onRestart={restart}
      help={<p className="arcade-help">Flechas o WASD para moverte · Espacio para pausar · Limpia los dos niveles. Las esferas grandes te permiten comer fantasmas por 6 segundos.</p>}
      controls={<div className="pacman-controls">
        <span className="keyboard-help">↑ ↓ ← → / WASD · Espacio para pausar</span>
        <div className="direction-pad" aria-label="Controles táctiles">
          {[['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']].map(([direction, label]) => <button key={direction} aria-label={`Mover ${direction}`} className={`button button--quiet direction-${direction}`} onClick={() => match.setDirection(direction)} type="button">{label}</button>)}
        </div>
        {match.powerMs > 0 && <p className="power-message">Poder activo · {Math.ceil(match.powerMs / 1000)} s</p>}
      </div>}
      onToggle={() => act((game) => game.status === 'ready' ? game.start() : game.status === 'paused' ? game.resume() : game.pause())}
      summary={<><div className="side-stat"><span>Puntuación</span><strong>{match.score}</strong></div><div className="side-stat"><span>Vidas</span><strong aria-label={`${match.lives} vidas`}>{'♥'.repeat(match.lives) || '0'}</strong></div><div className="side-stat"><span>Nivel</span><strong>{match.level} / {match.maxLevels}</strong></div><div className="side-stat"><span>Puntos restantes</span><strong>{match.maze.pelletsLeft}</strong></div></>}>
      <div className={`pacman-board${match.invulnerableMs > 0 ? ' is-invulnerable' : ''}`} role="img" aria-label={`Laberinto de Pac-Man. Puntuación ${match.score}, ${match.lives} vidas. Usa flechas o WASD.`} style={{ gridTemplateColumns: `repeat(${match.maze.rows[0].length}, 1fr)` }}>
        {match.maze.rows.flatMap((row, y) => [...row].map((cell, x) => {
          const position = { x, y };
          const player = samePosition(match.player.position, position);
          const ghost = match.ghosts.find((item) => samePosition(item.position, position) && item.cooldownMs === 0);
          const item = match.maze.items.get(positionKey(position));
          return <div key={`${x},${y}`} className={`maze-cell${cell === '#' ? ' maze-wall' : ''}`}>
            {player ? <span className={`pacman-character facing-${match.player.direction}`} /> : ghost ? <span className={`ghost ghost--${ghost.name}${match.powerMs > 0 ? ' is-frightened' : ''}`}>●</span> : item === '.' ? <i className="pellet" /> : item === 'o' ? <i className="power-pellet" /> : item === 'F' ? <span className="fruit">🍒</span> : null}
          </div>;
        }))}
      </div>
    </ArcadeLayout>
  );
}

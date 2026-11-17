import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArcadeLayout from './ArcadeLayout.jsx';
import { usePacmanGame } from './usePacmanGame.js';
import { PacmanRenderer } from '../games/pacman/PacmanRenderer.js';
import { PacmanAudio } from '../games/pacman/PacmanAudio.js';

const KEYS = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
const CONTROLS = [['up', '↑', 'arriba'], ['left', '←', 'izquierda'], ['down', '↓', 'abajo'], ['right', '→', 'derecha']];

function initialMuted() {
  try { return localStorage.getItem('gameconsole:pacman:muted') === 'true'; } catch { return false; }
}

function PacmanBoard({ match, boardRef, onToggle }) {
  const canvas = useRef(null);
  const swipe = useRef(null);
  useEffect(() => {
    const renderer = new PacmanRenderer(canvas.current);
    let frame;
    const draw = () => { renderer.draw(match); frame = requestAnimationFrame(draw); };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [match]);

  const overlay = match.status === 'ready' ? ['PAC-MAN', 'Pulsa Iniciar o toca el laberinto']
    : match.status === 'paused' ? ['PAUSA', 'Continúa cuando quieras']
    : match.status === 'finished' ? [match.result === 'WIN' ? '¡VICTORIA!' : 'GAME OVER', 'Puedes iniciar otra partida']
    : match.phase === 'ready' ? ['¡LISTO!', 'Prepárate para jugar']
    : match.phase === 'level-clear' ? ['NIVEL COMPLETADO', '¡Bien jugado!'] : null;
  return <div ref={boardRef} className="pacman-board pacman-board--canvas" tabIndex={0} role="img"
    aria-label={`Laberinto de Pac-Man. Puntuación ${match.score}, ${match.lives} vidas. Usa flechas o WASD.`}
    aria-describedby="pacman-instructions"
    style={{ '--maze-ratio': match.maze.width / match.maze.height }}
    onClick={() => { if (match.status === 'ready' || match.status === 'paused') onToggle(); }}
    onPointerDown={(event) => {
      event.currentTarget.focus({ preventScroll: true });
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        swipe.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }}
    onPointerMove={(event) => {
      if (!swipe.current) return;
      const dx = event.clientX - swipe.current.x; const dy = event.clientY - swipe.current.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      match.setDirection(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
      swipe.current = { x: event.clientX, y: event.clientY };
    }}
    onPointerUp={() => { swipe.current = null; }} onPointerCancel={() => { swipe.current = null; }}>
    <canvas ref={canvas} aria-hidden="true" />
    {overlay && <div className={`pacman-overlay${match.status === 'ready' || match.status === 'paused' || match.status === 'finished' ? ' is-shaded' : ''}`}><strong>{overlay[0]}</strong><span>{overlay[1]}</span></div>}
    {match.powerMs > 0 && !overlay && <div className="pacman-power" role="progressbar" aria-label="Poder restante" aria-valuemin={0} aria-valuemax={Math.max(2, 6 - (match.level - 1))} aria-valuenow={Math.ceil(match.powerMs / 1000)}>PODER · {Math.ceil(match.powerMs / 1000)} s</div>}
  </div>;
}

export default function PacmanGame(props) {
  const audio = useMemo(() => new PacmanAudio(), []);
  const [muted, setMuted] = useState(initialMuted);
  const boardRef = useRef(null);
  const { match, commit, act, error } = usePacmanGame({ ...props, onGameEvents: (events) => audio.play(events) });
  audio.enabled = !muted;
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => { if (match.status !== 'in-progress') audio.stop(); }, [audio, match.status]);

  const focusBoard = useCallback(() => boardRef.current?.focus({ preventScroll: true }), []);
  const toggle = useCallback(() => {
    audio.unlock();
    if (match.status === 'ready') match.start();
    else if (match.status === 'paused') match.resume();
    else if (match.status === 'in-progress') { match.pause(); audio.stop(); }
    commit(); focusBoard();
  }, [match, commit, audio, focusBoard]);
  const toggleSound = useCallback(() => {
    const next = !audio.enabled;
    audio.setEnabled(next); setMuted(!next);
    try { localStorage.setItem('gameconsole:pacman:muted', String(!next)); } catch { /* Preferencia opcional. */ }
    focusBoard();
  }, [audio, focusBoard]);

  useEffect(() => {
    function keydown(event) {
      if (event.target.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      const direction = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
      if (direction) { event.preventDefault(); match.setDirection(direction); }
      if ((event.code === 'Space' && event.target.tagName !== 'BUTTON') || event.key.toLowerCase() === 'p') { event.preventDefault(); toggle(); }
      if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleSound(); }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [match, toggle, toggleSound]);

  function restart() {
    audio.stop();
    if (match.status !== 'ready' && match.status !== 'finished') act((game) => game.end('LOSS'));
    props.onRestart('PACMAN');
  }

  return <ArcadeLayout {...props} title="Pac-Man" match={match} error={error} onRestart={restart} onToggle={toggle}
    extraActions={<button className="button button--quiet pacman-sound" type="button" aria-label={muted ? 'Activar sonido' : 'Desactivar sonido'} aria-pressed={!muted} onClick={toggleSound}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" />{muted ? <path d="M17 9 L22 15 M22 9 L17 15" /> : <><path d="M17 8 Q21 12 17 16" /><path d="M19 5 Q26 12 19 19" /></>}</svg></button>}
    help={<><p className="arcade-help">Come todos los puntos de los dos niveles. Las esferas grandes permiten comer fantasmas: 200, 400, 800 y 1600 puntos en una misma cadena. Las cerezas aparecen al avanzar y duran nueve segundos. Los túneles conectan ambos extremos.</p><div className="pacman-legend"><span><i className="ghost-dot ghost-dot--blinky" />Blinky te persigue</span><span><i className="ghost-dot ghost-dot--pinky" />Pinky se adelanta</span><span><i className="ghost-dot ghost-dot--inky" />Inky te rodea</span><span><i className="ghost-dot ghost-dot--clyde" />Clyde alterna su objetivo</span></div></>}
    controls={<div className="pacman-controls"><span className="keyboard-help">Flechas / WASD · Espacio o P: pausa · M: sonido</span><div className="direction-pad" aria-label="Controles táctiles">{CONTROLS.map(([direction, label, name]) => <button key={direction} aria-label={`Mover ${name}`} className={`button button--quiet direction-${direction}`} onClick={() => { match.setDirection(direction); focusBoard(); }} type="button">{label}</button>)}</div><span className="sr-only" id="pacman-instructions">Usa flechas, WASD, los botones de dirección o desliza el dedo sobre el laberinto. Espacio o P pausa la partida. M activa o silencia los efectos.</span></div>}
    summary={<><div className="side-stat"><span>Puntuación</span><strong>{match.score}</strong></div><div className="side-stat"><span>Vidas</span><strong aria-label={`${match.lives} vidas`}>{'♥'.repeat(match.lives) || '0'}</strong></div><div className="side-stat"><span>Nivel</span><strong>{match.level} / {match.maxLevels}</strong></div><div className="side-stat"><span>Puntos restantes</span><strong>{match.maze.pelletsLeft}</strong></div></>}>
    <PacmanBoard match={match} boardRef={boardRef} onToggle={toggle} />
  </ArcadeLayout>;
}

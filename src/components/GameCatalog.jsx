import PacmanIcon from './icons/PacmanIcon.jsx';
import MemoryIcon from './icons/MemoryIcon.jsx';
import MinesweeperIcon from './icons/MinesweeperIcon.jsx';

const SVG_ICON_CLASSES = 'pointer-events-none absolute right-7 top-[42px] h-[72px] w-[72px] transition-transform duration-200 motion-safe:group-hover:-translate-y-[3px] motion-safe:group-hover:rotate-[5deg] max-[660px]:right-[23px] max-[660px]:top-[29px] max-[660px]:h-16 max-[660px]:w-16';

const GAMES = [
  {
    id: 'CHESS',
    name: 'Ajedrez',
    tagline: 'Estrategia por turnos',
    description: 'Mueve, piensa y domina el tablero.',
    accent: 'chess',
    icon: '♞',
    available: true,
  },
  {
    id: 'PACMAN',
    name: 'Pac-Man',
    tagline: 'Arcade clásico',
    description: 'Recorre el laberinto y suma puntos.',
    accent: 'pacman',
    Icon: PacmanIcon,
    available: true,
  },
  {
    id: 'MEMORY',
    name: 'Memoria',
    tagline: 'Encuentra las parejas',
    description: 'Voltea cartas y pon a prueba tu memoria.',
    accent: 'memory',
    Icon: MemoryIcon,
    available: true,
  },
  {
    id: 'MINESWEEPER',
    name: 'Buscaminas',
    tagline: 'Lógica y exploración',
    description: 'Descubre las pistas y evita las minas.',
    accent: 'minesweeper',
    Icon: MinesweeperIcon,
    available: true,
  },
];

export default function GameCatalog({ selectedGameId, onSelect, onStart, chessOpponent, onChessOpponent }) {
  const selected = GAMES.find((game) => game.id === selectedGameId);

  return (
    <section className="catalog-section" aria-labelledby="catalog-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Tu próxima partida</p>
          <h2 id="catalog-title">Elige tu juego</h2>
        </div>
        <span className="catalog-count">{String(GAMES.length).padStart(2, '0')} EXPERIENCIAS</span>
      </div>

      <div className="game-grid">
        {GAMES.map((game, index) => (
          <button
            aria-pressed={selectedGameId === game.id}
            className={`group game-card game-card--${game.accent} motion-safe:animate-fade-up${selectedGameId === game.id ? ' is-selected' : ''}`}
            key={game.id}
            onClick={() => onSelect(game.id)}
            style={{ animationDelay: `${index * 90}ms` }}
            type="button"
          >
            <div className="game-card__topline">
              <span className="game-card__number">0{index + 1}</span>
              <span className={`game-status${game.available ? ' game-status--live' : ''}`}>
                {game.available ? 'LISTO PARA JUGAR' : 'PRÓXIMAMENTE'}
              </span>
            </div>
            {game.Icon ? (
              <span aria-hidden="true" className={SVG_ICON_CLASSES}><game.Icon /></span>
            ) : (
              <span aria-hidden="true" className="game-card__icon">{game.icon}</span>
            )}
            <div className="game-card__copy">
              <span className="game-card__tagline">{game.tagline}</span>
              <h3>{game.name}</h3>
              <p>{game.description}</p>
            </div>
            <span aria-hidden="true" className="game-card__arrow">↗</span>
          </button>
        ))}
      </div>

      <div className="selection-bar" aria-live="polite">
        <div className="selection-copy">
          <span className={`selection-dot${selected?.available ? ' is-live' : ''}`} />
          <div>
            <strong>{selected?.name ?? 'Selecciona un juego para comenzar'}</strong>
            <span>
              {!selected
                ? 'Elige una tarjeta del catálogo.'
                : selected.available
                ? selected.id === 'CHESS' ? chessOpponent === 'prolog' ? 'Tú contra la computadora · Prolog' : 'Partida local para dos jugadores' : 'Partida individual'
                : 'Módulo pendiente de implementación'}
            </span>
          </div>
        </div>
        {selected?.id === 'CHESS' && <fieldset className="chess-opponent"><legend>Oponente</legend>
          <label><input type="radio" name="chess-opponent" value="prolog" checked={chessOpponent === 'prolog'} onChange={() => onChessOpponent('prolog')} /> Computadora · Prolog</label>
          <label><input type="radio" name="chess-opponent" value="local" checked={chessOpponent === 'local'} onChange={() => onChessOpponent('local')} /> Dos personas</label>
        </fieldset>}
        {selected?.available ? (
          <button className="button button--primary" onClick={onStart} type="button">
            <span aria-hidden="true">＋</span> Nueva partida
          </button>
        ) : selected ? (
          <span className="selection-note">Disponible en una próxima etapa</span>
        ) : null}
      </div>
    </section>
  );
}

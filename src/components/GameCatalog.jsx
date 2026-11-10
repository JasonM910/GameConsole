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
    icon: '◉',
    available: false,
  },
  {
    id: 'RACING',
    name: 'Carreras',
    tagline: 'Velocidad y precisión',
    description: 'Prepárate para competir en la pista.',
    accent: 'racing',
    icon: '↗',
    available: false,
  },
];

export default function GameCatalog({ selectedGameId, onSelect, onStart }) {
  const selected = GAMES.find((game) => game.id === selectedGameId);

  return (
    <section className="catalog-section" aria-labelledby="catalog-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Tu próxima partida</p>
          <h2 id="catalog-title">Elige tu juego</h2>
        </div>
        <span className="catalog-count">03 EXPERIENCIAS</span>
      </div>

      <div className="game-grid">
        {GAMES.map((game, index) => (
          <button
            aria-pressed={selectedGameId === game.id}
            className={`game-card game-card--${game.accent}${selectedGameId === game.id ? ' is-selected' : ''}`}
            key={game.id}
            onClick={() => onSelect(game.id)}
            type="button"
          >
            <div className="game-card__topline">
              <span className="game-card__number">0{index + 1}</span>
              <span className={`game-status${game.available ? ' game-status--live' : ''}`}>
                {game.available ? 'LISTO PARA JUGAR' : 'PRÓXIMAMENTE'}
              </span>
            </div>
            <span aria-hidden="true" className="game-card__icon">{game.icon}</span>
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
            <strong>{selected?.name}</strong>
            <span>
              {selected?.available
                ? 'Partida local para dos jugadores'
                : 'Módulo pendiente de implementación'}
            </span>
          </div>
        </div>
        {selected?.available ? (
          <button className="button button--primary" onClick={onStart} type="button">
            <span aria-hidden="true">＋</span> Nueva partida
          </button>
        ) : (
          <span className="selection-note">Disponible en una próxima etapa</span>
        )}
      </div>
    </section>
  );
}

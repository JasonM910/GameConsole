import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChessGame from './components/ChessGame.jsx';
import PacmanGame from './components/PacmanGame.jsx';
import MemoryGame from './components/MemoryGame.jsx';
import StatisticsPanel from './components/StatisticsPanel.jsx';
import GameCatalog from './components/GameCatalog.jsx';
import { ChessMatch } from './games/chess/ChessMatch.js';
import { PacmanMatch } from './games/pacman/PacmanMatch.js';
import { MemoryMatch } from './games/memory/MemoryMatch.js';
import { EventAdapter } from './services/EventAdapter.js';
import { EventDelivery } from './services/EventDelivery.js';
import { loadMatches, saveMatch } from './services/matchStorage.js';

function initialStorage() {
  try {
    return { matches: loadMatches(), error: '' };
  } catch (error) {
    return { matches: [], error: error.message };
  }
}

function makeMatchEvents(match, adapter) {
  return ['w', 'b'].map((color) => adapter.createEvent({
    gameId: 'CHESS',
    matchId: match.id,
    playerId: match.playerIdFor(color),
    type: 'MATCH_STARTED',
    data: { side: color === 'w' ? 'WHITE' : 'BLACK' },
  }));
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export default function App() {
  const [storage, setStorage] = useState(initialStorage);
  const [selectedGameId, setSelectedGameId] = useState('CHESS');
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [delivery, setDelivery] = useState({
    status: 'pending',
    message: 'Comprobando eventos pendientes de sincronización.',
  });
  const adapter = useMemo(() => new EventAdapter({ endpoint: import.meta.env.VITE_GAMESTATS_URL ?? '/api/events' }), []);
  const eventDelivery = useMemo(() => new EventDelivery(adapter), [adapter]);
  const deliveryRequest = useRef(0);
  const matches = storage.matches;
  const activeRecord = matches.find((match) => match.id === activeMatchId);

  const publishEvents = useCallback(async () => {
    const request = ++deliveryRequest.current;
    setDelivery({ status: 'pending', message: 'Sincronizando eventos guardados con GameStats…' });
    try {
      const result = await eventDelivery.sync();
      if (request === deliveryRequest.current) setDelivery(result);
      return result;
    } catch (error) {
      const result = { status: 'failed', message: `${error.message}. Los eventos siguen guardados; se reintentará el envío.` };
      if (request === deliveryRequest.current) setDelivery(result);
      return result;
    }
  }, [eventDelivery]);

  useEffect(() => {
    void publishEvents();
    const timer = setInterval(publishEvents, 15000);
    window.addEventListener('online', publishEvents);
    return () => { clearInterval(timer); window.removeEventListener('online', publishEvents); };
  }, [publishEvents]);

  const refreshMatches = useCallback(() => {
    try {
      setStorage({ matches: loadMatches(), error: '' });
    } catch (error) {
      setStorage((current) => ({ ...current, error: error.message }));
    }
  }, []);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === null || event.key.startsWith('gameconsole:match:')) {
        refreshMatches();
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshMatches]);

  function startMatch(gameId = selectedGameId) {
    try {
      if (gameId === 'PACMAN' || gameId === 'MEMORY') {
        const match = gameId === 'PACMAN' ? new PacmanMatch() : new MemoryMatch();
        saveMatch(match.toJSON());
        refreshMatches();
        setActiveMatchId(match.id);
        return;
      }
      const match = new ChessMatch();
      const events = makeMatchEvents(match, adapter);
      for (const event of events) {
        match.appendEvent(event);
      }
      saveMatch(match.toJSON());
      refreshMatches();
      setActiveMatchId(match.id);
      void publishEvents(events);
    } catch (error) {
      setStorage((current) => ({ ...current, error: error.message }));
    }
  }

  function persistMatch(record) {
    try {
      saveMatch(record);
      refreshMatches();
    } catch (error) {
      setStorage((current) => ({ ...current, error: error.message }));
      throw error;
    }
  }

  if (activeRecord?.gameId === 'CHESS') {
    return (
      <ChessGame
        adapter={adapter}
        delivery={delivery}
        matches={matches}
        onBack={() => setActiveMatchId(null)}
        onEvents={publishEvents}
        onOpenMatch={setActiveMatchId}
        onSave={persistMatch}
        record={activeRecord}
      />
    );
  }

  if (activeRecord?.gameId === 'PACMAN' || activeRecord?.gameId === 'MEMORY') {
    const Game = activeRecord.gameId === 'PACMAN' ? PacmanGame : MemoryGame;
    return <Game key={activeRecord.id} record={activeRecord} adapter={adapter}
      delivery={delivery} onSave={persistMatch} onEvents={publishEvents}
      onBack={() => setActiveMatchId(null)} onRestart={startMatch} />;
  }

  if (showStats) {
    return <main className="home-layout"><header className="match-topbar"><button className="text-button" onClick={() => setShowStats(false)} type="button">← Consola</button><span className="match-brand">GAME<span className="brand-highlight">STATS</span></span></header><div className="home-content"><StatisticsPanel onSync={publishEvents} delivery={delivery} /></div></main>;
  }

  return (
    <main className="home-layout">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <header className="home-topbar">
        <a aria-label="GameConsole inicio" className="brand" href="#inicio">
          <span className="brand-mark motion-safe:animate-pixel-glow">G</span>
          <span>GAME<span className="brand-highlight">CONSOLE</span></span>
        </a>
        <button className="button button--quiet" onClick={() => setShowStats(true)} type="button">Estadísticas ↗</button>
        <span className="profile-chip"><span>J</span> JUGADOR</span>
      </header>

      <section className="hero motion-safe:animate-fade-up" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> BIENVENIDO A TU ARCADE</p>
          <h1>Tu próximo<br /><span>gran juego.</span></h1>
          <p className="hero-description">
            Elige una partida, reta tu estrategia y descubre todo lo que puedes lograr.
            Tu aventura comienza aquí.
          </p>
          <div className="hero-footnote"><span>01</span><i /> TRES JUEGOS. UN SOLO LUGAR.</div>
        </div>
        <div aria-hidden="true" className="hero-art motion-safe:animate-arcade-float">
          <div className="hero-art__ring hero-art__ring--outer" />
          <div className="hero-art__ring hero-art__ring--inner" />
          <span className="hero-art__cross">＋</span>
          <span className="hero-art__spark hero-art__spark--a">✳</span>
          <span className="hero-art__spark hero-art__spark--b">✦</span>
          <div className="hero-art__tile hero-art__tile--back"><span>♟</span></div>
          <div className="hero-art__tile hero-art__tile--front"><span>♞</span></div>
          <div className="hero-art__caption"><span>THINK</span><i /> <span>PLAY</span><i /> <span>REPEAT</span></div>
        </div>
      </section>

      <div className="home-content">
        <GameCatalog
          onSelect={setSelectedGameId}
          onStart={() => startMatch()}
          selectedGameId={selectedGameId}
        />

        {storage.error && <p className="storage-error" role="alert">{storage.error}</p>}

        <section className="saved-section" aria-labelledby="saved-title">
          <div className="section-heading section-heading--saved">
            <div><p className="eyebrow">Sigue donde lo dejaste</p><h2 id="saved-title">Tus partidas</h2></div>
            <span className="saved-total">{String(matches.length).padStart(2, '0')} GUARDADAS</span>
          </div>
          {matches.length === 0 ? (
            <div className="empty-sessions"><span>♙</span><p>Aún no hay partidas.<br />Elige un juego y crea la primera.</p></div>
          ) : (
            <div className="saved-grid">
              {matches.map((match) => (
                <button className="saved-card" key={match.id} onClick={() => setActiveMatchId(match.id)} type="button">
                  <span className="saved-card__icon">{match.gameId === 'CHESS' ? '♞' : match.gameId === 'PACMAN' ? '◉' : '▣'}</span>
                  <span className="saved-card__main">
                    <strong>{{ CHESS: 'Ajedrez', PACMAN: 'Pac-Man', MEMORY: 'Memoria' }[match.gameId]}</strong>
                    <small>{match.id.slice(0, 8).toUpperCase()} · {formatDate(match.createdAt)}</small>
                  </span>
                  <span className={`saved-card__status${match.status === 'finished' ? ' is-done' : ''}`}>
                    {match.status === 'finished' ? 'FINALIZADA' : 'EN CURSO'}
                  </span>
                  <span aria-hidden="true" className="saved-card__arrow">↗</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="page-footer"><span>GAMECONSOLE · ETAPA 01</span><span>UN PROYECTO PARA JUGAR Y APRENDER.</span></footer>
    </main>
  );
}

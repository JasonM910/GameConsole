const CHESS_FIELDS = {
  MATCH_STARTED: { side: 'side' },
  MOVE_PLAYED: {
    ply: 'positiveInteger',
    piece: 'piece',
    from: 'square',
    to: 'square',
    thinkTimeSeconds: 'nonNegativeInteger',
  },
  PIECE_CAPTURED: { ply: 'positiveInteger', capturedPiece: 'piece' },
  CHECK_GIVEN: { ply: 'positiveInteger' },
  CHECKMATE: { ply: 'positiveInteger' },
  MATCH_FINISHED: { result: 'result', durationSeconds: 'nonNegativeInteger' },
};

const PACMAN_FIELDS = {
  MATCH_STARTED: {},
  MATCH_FINISHED: { result: 'text', durationSeconds: 'nonNegativeInteger' },
  PELLET_EATEN: { points: 'nonNegativeInteger' },
  POWER_PELLET_EATEN: { points: 'nonNegativeInteger', powerDurationSeconds: 'positiveInteger' },
  GHOST_EATEN: { ghost: 'text', points: 'nonNegativeInteger' },
  FRUIT_EATEN: { fruit: 'text', points: 'nonNegativeInteger' },
  LIFE_LOST: { remainingLives: 'nonNegativeInteger', ghost: 'text' },
  LEVEL_COMPLETED: { level: 'positiveInteger', durationSeconds: 'nonNegativeInteger' },
};

const SCHEMAS = { CHESS: CHESS_FIELDS, PACMAN: PACMAN_FIELDS };
const PIECES = new Set(['PAWN', 'KNIGHT', 'BISHOP', 'ROOK', 'QUEEN', 'KING']);
const RESULTS = new Set(['WIN', 'LOSS', 'DRAW']);
const SQUARE = /^[a-h][1-8]$/;

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validValue(kind, value) {
  switch (kind) {
    case 'side':
      return value === 'WHITE' || value === 'BLACK';
    case 'piece':
      return PIECES.has(value);
    case 'square':
      return typeof value === 'string' && SQUARE.test(value);
    case 'result':
      return RESULTS.has(value);
    case 'text':
      return isNonEmptyText(value);
    case 'positiveInteger':
      return Number.isSafeInteger(value) && value > 0;
    case 'nonNegativeInteger':
      return Number.isSafeInteger(value) && value >= 0;
    default:
      return false;
  }
}

function validateData(gameId, type, data) {
  const gameSchema = SCHEMAS[gameId];
  if (!gameSchema) {
    throw new Error(`GameStats no admite el juego ${gameId}`);
  }
  const fields = gameSchema[type];
  if (!fields) {
    throw new Error(`GameStats no admite el evento ${type} para ${gameId}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('data debe ser un objeto');
  }

  const required = Object.keys(fields).sort();
  const actual = Object.keys(data).sort();
  if (required.join('\0') !== actual.join('\0')) {
    throw new Error(`data debe contener exactamente: ${required.join(', ') || 'ningún campo'}`);
  }
  for (const [name, kind] of Object.entries(fields)) {
    if (!validValue(kind, data[name])) {
      throw new Error(`data.${name} no cumple el tipo admitido por GameStats`);
    }
  }
  if (gameId === 'CHESS' && type === 'MOVE_PLAYED' && data.from === data.to) {
    throw new Error('data.from y data.to deben ser casillas diferentes');
  }
}

export class EventAdapter {
  constructor({ endpoint = import.meta.env?.VITE_GAMESTATS_URL ?? '', fetchImpl = globalThis.fetch } = {}) {
    this.endpoint = endpoint.trim();
    this.fetchImpl = fetchImpl;
  }

  createEvent({ gameId, matchId, playerId, type, data }) {
    for (const [name, value] of Object.entries({ gameId, matchId, playerId, type })) {
      if (!isNonEmptyText(value)) {
        throw new Error(`${name} es obligatorio`);
      }
    }
    validateData(gameId, type, data);

    return {
      eventId: globalThis.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      gameId,
      gameVersion: '0.1.0',
      matchId,
      playerId,
      type,
      data: { ...data },
    };
  }

  async send(event) {
    if (!this.endpoint) {
      return {
        status: 'pending',
        message: 'GameStats no ofrece una API HTTP; el evento queda guardado localmente.',
      };
    }
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch no está disponible para enviar eventos');
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([event]),
    });
    if (!response.ok) {
      return {
        status: 'failed',
        message: `El servicio respondió HTTP ${response.status}.`,
      };
    }
    return { status: 'sent', message: 'El servicio configurado respondió correctamente.' };
  }
}

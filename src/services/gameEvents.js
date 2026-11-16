// Convierte los hechos del modelo al contrato compartido, separado del transporte.
export function collectGameEvents(match, adapter) {
  const events = match.pendingEvents.map(({ type, data }) => adapter.createEvent({
    gameId: match.gameId, matchId: match.id, playerId: match.players.player, type, data,
  }));
  events.forEach((event) => match.appendEvent(event));
  match.pendingEvents = [];
  return events;
}

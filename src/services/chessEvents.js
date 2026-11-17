export function finishChessEvents(match, result, adapter) {
  return ['w', 'b'].map((color) => adapter.createEvent({
    gameId: 'CHESS', matchId: match.id, playerId: match.playerIdFor(color), type: 'MATCH_FINISHED',
    data: { result: result === 'DRAW' ? 'DRAW' : result === color ? 'WIN' : 'LOSS', durationSeconds: match.elapsedSeconds() },
  }));
}

export function playChessMove(match, decision, adapter) {
  const move = match.playMove(decision);
  const create = (type, data) => adapter.createEvent({ gameId: 'CHESS', matchId: match.id, playerId: move.playerId, type, data });
  const events = [create('MOVE_PLAYED', { ply: move.ply, piece: move.piece, from: move.from, to: move.to, thinkTimeSeconds: move.thinkTimeSeconds })];
  if (move.capturedPiece) events.push(create('PIECE_CAPTURED', { ply: move.ply, capturedPiece: move.capturedPiece }));
  if (move.gaveCheck) events.push(create('CHECK_GIVEN', { ply: move.ply }));
  if (move.checkmate) events.push(create('CHECKMATE', { ply: move.ply }));
  if (move.gameOver) events.push(...finishChessEvents(match, move.result, adapter));
  events.forEach((event) => match.appendEvent(event));
  return move;
}

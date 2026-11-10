const MATCH_PREFIX = 'gameconsole:match:';

export function saveMatch(record) {
  if (!record?.id || !record.gameId) {
    throw new Error('No se puede guardar una partida sin id y gameId');
  }
  localStorage.setItem(`${MATCH_PREFIX}${record.id}`, JSON.stringify(record));
}

export function loadMatches() {
  const records = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(MATCH_PREFIX)) {
      continue;
    }

    try {
      const record = JSON.parse(localStorage.getItem(key));
      if (!record?.id || !record.gameId || key !== `${MATCH_PREFIX}${record.id}`) {
        throw new Error('el identificador del registro no coincide con su clave');
      }
      records.push(record);
    } catch (error) {
      throw new Error(`No se pudo leer la partida guardada (${key}): ${error.message}`);
    }
  }
  return records.sort((left, right) => right.createdAt - left.createdAt);
}

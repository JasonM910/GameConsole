// Los proxies también pueden responder con HTML o sin cuerpo si falla el servicio.
export async function readJsonResponse(response) {
  const fallback = response.status >= 500
    ? `GameStats no está disponible (HTTP ${response.status}). Comprueba que sus servicios estén iniciados.`
    : `GameStats respondió HTTP ${response.status}.`;
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(response.ok ? 'GameStats devolvió una respuesta vacía o un JSON inválido.' : fallback);
  }
  if (!response.ok) {
    throw new Error(typeof payload?.error?.message === 'string' ? payload.error.message : fallback);
  }
  return payload;
}

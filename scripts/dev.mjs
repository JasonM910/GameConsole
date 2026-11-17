import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { gameStatsTarget, prologTarget } from './devConfig.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = loadEnv('development', root, '');
const target = gameStatsTarget(env);
const aiTarget = prologTarget(env);

function run(command, args, quiet = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: quiet ? 'ignore' : 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} terminó con código ${code}`)));
  });
}

async function isReady() {
  try {
    const response = await fetch(new URL('/health', target), { signal: AbortSignal.timeout(4000) });
    if (!response.ok || (await response.json()).status !== 'ok') return false;
    const ai = await fetch(new URL('/api/prolog/health', aiTarget), { signal: AbortSignal.timeout(4000) });
    return ai.ok && (await ai.json()).status === 'ok';
  } catch { return false; }
}

try {
  if (!await isReady()) {
    const composeTarget = gameStatsTarget({ GAMECONSOLE_PORT: env.GAMECONSOLE_PORT });
    if (target !== composeTarget) {
      throw new Error(`Comprueba GameStats en ${target} y Prolog en ${aiTarget}. Inicia Go, Scala y Prolog o corrige los destinos del proxy.`);
    }
    console.log('Iniciando GameStats y Prolog con Docker Compose…');
    try {
      await run('docker', ['info', '--format', '{{.ServerVersion}}'], true);
    } catch {
      if (process.platform !== 'win32' && process.platform !== 'darwin') throw new Error('Inicia Docker y vuelve a ejecutar npm run dev.');
      console.log('Iniciando Docker Desktop…');
      await run('docker', ['desktop', 'start', '--timeout', '120']);
    }
    await run('docker', ['compose', 'up', '--build', '-d', '--wait', '--wait-timeout', '120']);
    if (!await isReady()) throw new Error(`GameStats aún no responde en ${target}. Revisa docker compose logs.`);
  }
  console.log(`GameStats disponible en ${target}. Iniciando Vite…`);
  await run(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), ...process.argv.slice(2)]);
} catch (error) {
  console.error(`No se pudo iniciar el entorno: ${error.message}`);
  console.error('Para abrir únicamente la interfaz sin GameStats: npm run dev:ui');
  process.exitCode = 1;
}

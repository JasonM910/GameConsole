# GameConsole

Consola arcade sobre la estructura existente de React 18, Vite, JavaScript y Tailwind CSS. Incluye Ajedrez local, Pac-Man, Memoria y un panel conectado con GameStats. Las reglas viven en clases, las vistas en componentes React y los eventos/persistencia en servicios.

## Ejecución integrada con Docker

Se necesitan Docker Desktop con contenedores Linux y Docker Compose. Los dos repositorios deben estar juntos:

```text
Proyecto2/
  GameConsole/
  GameStats/
```

Desde `GameConsole`:

```powershell
docker compose up --build -d --wait
```

Abrir **http://localhost:8088**. `web` sirve la aplicación con Nginx; `/api` se comunica con Go, que valida y conserva los eventos. Scala recibe documentos del esquema existente y utiliza `Analyzer` para calcular los resultados. Los servicios internos no publican puertos al equipo.

```powershell
docker compose logs -f
docker compose down
```

El volumen `gamestats-data` conserva `/data/partidas.json` y `/data/resultados.json` al reiniciar o recrear los contenedores. No utilizar `down -v` si se necesita conservar el histórico. Las posiciones de los juegos y los eventos pendientes permanecen en el `localStorage` del navegador.

El Compose original de `GameStats` sigue ejecutando la simulación y el análisis por archivos de manera independiente. No comparte el volumen de la API ni sobrescribe los archivos históricos.

## Desarrollo con Vite y GameStats

Con Node.js 22 y Docker Desktop instalados, desde `GameConsole`:

```powershell
npm ci
npm run dev
```

El comando comprueba GameStats, inicia Docker Desktop si es necesario y levanta los servicios con Compose antes de abrir Vite. El proxy utiliza el puerto publicado 8088, manteniendo Go y Scala internos y el mismo histórico persistente. `npm run services` permite levantar los servicios por separado. `npm run dev:ui` abre únicamente Vite, sin iniciar dependencias; si GameStats no está disponible se mostrará un mensaje de conexión y se conservarán los eventos pendientes.

## Desarrollo sin Docker

Se necesitan Node.js 22, Go 1.22 o posterior, Java 21 y sbt. Abrir tres terminales:

```powershell
# Terminal 1: GameStats/scala
sbt "runMain AnalysisServer"

# Terminal 2: GameStats
go run . -serve

# Terminal 3: GameConsole
npm ci
$env:GAMESTATS_PROXY_TARGET = 'http://127.0.0.1:8080'
npm run dev
```

Vite muestra su dirección local y, con esa variable explícita, redirige `/api` a Go en `http://127.0.0.1:8080`. El servidor Scala utiliza el puerto 8081. Con un destino explícito distinto al de Compose, `npm run dev` verifica su disponibilidad y avisa si falta iniciar Go o Scala.

## Juegos

- **Ajedrez:** mantiene `chess.js`, dos jugadores, movimientos legales, promoción, jaque, mate, tablas, abandono y restauración de partidas. El oponente Prolog sigue pendiente; no se simula una IA.
- **Pac-Man:** iniciar con el botón, mover con flechas/WASD o controles táctiles, pausar con espacio o botón. Tiene tres vidas, fantasmas con persecución/dispersión y huida bajo poder, puntos, frutas y esferas de poder de seis segundos. Se gana al limpiar los dos niveles; se pierde al agotar las vidas. Puntos: normal 10, poder 50, fruta 100, fantasma 200. El segundo nivel acelera los fantasmas.
- **Memoria:** ocho parejas en un tablero 4×4, límite de 180 segundos de juego activo, dos cartas por intento y espera de 800 ms tras un fallo. Encontrar una pareja deja disponibles las demás cartas. Termina al encontrar todas o al agotar el tiempo.

Pac-Man y Memoria se pausan al cambiar de ventana o abandonar la vista. Al restaurar una partida se debe pulsar «Continuar». El reloj avanza únicamente mientras se juega. Reiniciar finaliza la partida anterior como derrota si estaba iniciada y crea otro UUID, conservando su historia.

## Eventos y estadísticas

`EventAdapter` mantiene el contrato exacto de GameStats: `eventId`, `timestamp` RFC3339, `gameId`, `gameVersion`, `matchId`, `playerId`, `type`, `data`. No se agregan tipos de movimiento o pausa que no existan en el catálogo de GameStats. Los hechos de los modelos nuevos se convierten al contrato mediante `gameEvents.js`.

La partida se guarda antes de enviarla. `EventDelivery` transmite lotes ordenados de hasta 100 eventos, conserva los IDs al reintentar y registra confirmaciones aparte de las posiciones del juego. Reintenta al abrir la consola, recuperar conexión y cada 15 segundos. Un fallo HTTP o confirmación incompleta conserva el lote pendiente. La API acepta reenvíos idénticos sin duplicar estadísticas y rechaza IDs reutilizados con otros datos.

«Estadísticas» consulta `/api/stats`, permite filtrar por juego/jugador y muestra las secciones originales de Scala: jugadores (partidas finalizadas, victorias, derrotas, empates, porcentaje de victorias), juegos, historial, métricas específicas y patrones. No calcula estadísticas alternativas en React. Se actualiza cada diez segundos o manualmente; presenta errores, carga y ausencia de datos. El filtro de jugador selecciona sus partidas completas, incluyendo al oponente de Ajedrez para conservar ambos resultados.

Los identificadores predeterminados siguen las convenciones existentes: `PLAYER_ONE` para los juegos individuales, `PLAYER_WHITE` y `PLAYER_BLACK` para Ajedrez. Son etiquetas locales, no cuentas autenticadas.

## Configuración

Copiar `.env.example` a `.env` si se requieren otros valores:

| Variable | Valor predeterminado | Uso |
| --- | --- | --- |
| `VITE_GAMESTATS_URL` | `/api/events` | Endpoint público de eventos. Vacío desactiva el envío. |
| `VITE_GAMESTATS_STATS_URL` | `/api/stats` | Endpoint público de consulta. |
| `GAMESTATS_PROXY_TARGET` | `http://127.0.0.1:8088` | Destino publicado de Compose para Vite. Usar 8080 si se ejecuta Go sin Docker. |
| `GAMECONSOLE_PORT` | `8088` | Puerto publicado por Compose. |

Las variables `VITE_*` se incorporan durante la compilación. La imagen Docker usa las rutas relativas predeterminadas; Nginx conoce los nombres internos de Compose. Las variables de Go y Scala están documentadas en `../GameStats/README.md`.

## Verificación

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e

# Con Compose ya iniciado:
$env:GAMESTATS_BASE_URL = 'http://127.0.0.1:8088'
npm run test:integration
```

Las pruebas de navegador cubren movimiento/pausa/restauración/reinicio de Pac-Man, todas las parejas de Memoria, estados del panel y regresión de Ajedrez. Para usar Edge instalado: `$env:PLAYWRIGHT_CHANNEL = 'msedge'`. `PLAYWRIGHT_BASE_URL` permite probar el sitio servido por Docker en lugar de iniciar Vite.

El smoke test genera partidas mediante las clases reales, envía sus eventos dos veces y comprueba métricas Scala, resultados y filtros. Para verificar persistencia:

```powershell
$env:INTEGRATION_RECEIPT = Join-Path $env:TEMP 'gameconsole-integration.json'
npm run test:integration
docker compose restart gamestats
docker compose up -d --wait
node scripts/smoke-integration.mjs --verify
```

Para incluir la prueba de navegador con recepción real de eventos y consulta de métricas Scala:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:8088'
$env:GAMESTATS_LIVE = '1'
npm run test:e2e
```

Esta prueba agrega tres partidas de validación al histórico; usar un proyecto Compose separado (`docker compose -p gameconsole-check ...`) para aislarlas de partidas personales.

## CI/CD y deployment

`.github/workflows/ci.yml` instala dependencias, ejecuta pruebas de modelos y navegador, compila y publica `dist` como artefacto. Otro trabajo obtiene GameStats como repositorio hermano, construye las imágenes, ejecuta el smoke test integrado y comprueba persistencia tras reiniciar Go. Publica también la imagen web probada.

Como son repositorios separados, configurar `GAMESTATS_REPOSITORY` (por defecto `JasonM910/GameStats`) y `GAMESTATS_REF` con la rama o commit que incluya la API. La ejecución manual permite escoger `gamestats_ref`. Ambos cambios deben publicarse en ramas compatibles antes de ejecutar esa integración en GitHub. El workflow de GameStats conserva la validación por archivos y añade una validación HTTP propia.

El deployment definido es Docker Compose en el equipo o servidor elegido, actualizando ambos repositorios y ejecutando `docker compose up --build -d --wait`. No se configura un servidor remoto ni credenciales que no existan en el proyecto. Para exposición pública se requiere configurar dominio/HTTPS y el control de acceso del entorno; la API actual es para la consola local y usa un único proceso escritor sobre JSON.

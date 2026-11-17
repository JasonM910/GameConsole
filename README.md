# GameConsole

Consola arcade sobre la estructura existente de React 18, Vite, JavaScript y Tailwind CSS. Incluye Ajedrez local, Pac-Man, Memoria, Buscaminas y un panel conectado con GameStats. Las reglas viven en clases, las vistas en componentes React y los eventos/persistencia en servicios.

El catálogo actual ofrece cuatro juegos. El enunciado académico solicita exactamente tres; se debe acordar cuáles presentar en la entrega final.

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

- **Ajedrez:** mantiene `chess.js`, dos jugadores, movimientos legales, promoción, jaque, mate, tablas, abandono y restauración de partidas. El aviso sobre el tablero distingue jaque, jaque mate, tablas y abandono; resalta el rey amenazado, muestra la última jugada y anuncia al ganador. El resultado se conserva al restaurar la partida. El oponente Prolog sigue pendiente; no se simula una IA.
- **Pac-Man clásico:** laberinto propio de 21×22, cuatro fantasmas, túneles laterales y movimiento continuo en Canvas. Iniciar con el botón o tocando el laberinto; mover con flechas/WASD, botones o deslizamientos. Espacio o P pausa; M activa o silencia los efectos sintetizados. Los giros se pueden preparar antes de llegar a una esquina y la marcha se puede invertir en un pasillo. Tiene tres vidas y dos niveles; el segundo aumenta la velocidad de los fantasmas. Puntos: normal 10, poder 50, cerezas 100 y cadena de fantasmas 200/400/800/1600. El poder dura seis segundos en el primer nivel y cinco en el segundo. Las cerezas aparecen al consumir el 35 % y el 70 % de los puntos y duran nueve segundos. Se gana al limpiar ambos niveles y se pierde al agotar las vidas, con animaciones de cierre.
- **Memoria:** ocho parejas en un tablero 4×4, límite de 180 segundos de juego activo, dos cartas por intento y espera de 800 ms tras un fallo. Encontrar una pareja deja disponibles las demás cartas. Termina al encontrar todas o al agotar el tiempo.
- **Buscaminas:** tablero de 9×9 con diez minas. Pulsar «Iniciar» y abrir una casilla; el primer clic es seguro y abre una zona vacía cuando hay espacio. Las casillas vacías descubren automáticamente sus vecinas. Después del primer clic se pueden colocar o retirar hasta diez banderas con clic derecho o con el modo «Marcar banderas» en pantallas táctiles. Se gana al abrir las 71 casillas sin minas, sin necesidad de marcar todas las minas; pisar una mina termina en derrota. Al finalizar se muestran las minas y las banderas incorrectas.

Pac-Man, Memoria y Buscaminas se pausan al cambiar de ventana o abandonar la vista. Al restaurar una partida se debe pulsar «Continuar». El reloj avanza únicamente mientras se juega. Reiniciar finaliza la partida anterior como derrota si estaba iniciada y crea otro UUID, conservando su historia.

Los tableros se ajustan al ancho y a la altura de la ventana. Los controles principales y las métricas de los juegos individuales están sobre el tablero; las instrucciones y la información de sincronización son desplegables. En pantallas horizontales bajas, los controles se ubican al lado del juego. Al cambiar entre consola, partida y estadísticas se vuelve al inicio de la vista.

Pac-Man separa `PacmanMatch` (reglas, fases y eventos), `Pacman`/`Ghost` (desplazamiento y objetivos), `Maze` (pasillos, puerta y rutas), `PacmanRenderer` (dibujo) y `PacmanAudio` (efectos generados). La simulación y el dibujo usan `requestAnimationFrame`; React actualiza el panel aproximadamente cada 100 ms y se guarda al emitir eventos, cada 500 ms de juego o al pausar. Blinky persigue al jugador, Pinky apunta por delante, Inky proyecta su objetivo respecto a Blinky y Clyde alterna persecución y retirada. Los fantasmas comidos regresan físicamente a la casa. Se conservan los identificadores, eventos y laberintos de partidas anteriores; para usar el escenario nuevo se crea una nueva partida.

Referencias de comportamiento: [The Pac-Man Dossier, de Jamey Pittman](https://pacman.holenet.info/). Se evaluaron [masonicGIT/pacman](https://github.com/masonicGIT/pacman) y otras versiones existentes; se eligió una implementación propia para mantener las clases del proyecto, el guardado y el contrato de GameStats. El código, el laberinto, el dibujo vectorial y los efectos de esta integración se desarrollaron dentro de GameConsole.

## Eventos y estadísticas

`EventAdapter` mantiene el contrato exacto de GameStats: `eventId`, `timestamp` RFC3339, `gameId`, `gameVersion`, `matchId`, `playerId`, `type`, `data`. No se agregan tipos de movimiento o pausa que no existan en el catálogo de GameStats. Los hechos de los modelos nuevos se convierten al contrato mediante `gameEvents.js`.

Buscaminas usa `gameId: MINESWEEPER` y los eventos existentes `MATCH_STARTED`, `CELL_REVEALED`, `FLAG_PLACED`, `FLAG_REMOVED`, `MINE_TRIGGERED`, `BOARD_COMPLETED` y `MATCH_FINISHED`. Las coordenadas de eventos comienzan en cero. `MinesweeperBoard` administra las casillas, minas, vecinos y apertura en cadena; `MinesweeperMatch` controla el ciclo de vida y emite los hechos. Scala calcula las casillas reveladas, precisión de banderas y el patrón de bandera incorrecta corregida; React presenta esos resultados.

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

Las pruebas de navegador cubren movimiento/pausa/restauración/reinicio de Pac-Man, todas las parejas de Memoria, banderas/pausa/restauración/reinicio/victoria/derrota de Buscaminas, estados del panel y regresión de Ajedrez. Para usar Edge instalado: `$env:PLAYWRIGHT_CHANNEL = 'msedge'`. `PLAYWRIGHT_BASE_URL` permite probar el sitio servido por Docker en lugar de iniciar Vite.

El smoke test genera cuatro partidas mediante las clases reales, envía sus eventos dos veces y comprueba métricas Scala, resultados y filtros. Para Buscaminas verifica casillas reveladas, precisión de banderas y el patrón `FLAG_CORRECTED`. Para verificar persistencia:

```powershell
$env:INTEGRATION_RECEIPT = Join-Path $env:TEMP 'gameconsole-integration.json'
npm run test:integration
docker compose restart gamestats
docker compose up -d --wait
node scripts/smoke-integration.mjs --verify
```

Para incluir las pruebas de navegador de Pac-Man, Memoria y Buscaminas con recepción real de eventos y consulta de métricas Scala:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:8088'
$env:GAMESTATS_LIVE = '1'
npm run test:e2e
```

El smoke test agrega cuatro partidas y las pruebas de navegador reales agregan otras tres al histórico; usar un proyecto Compose separado (`docker compose -p gameconsole-check ...`) para aislarlas de partidas personales. La prueba de Pac-Man consulta los puntos de la partida en curso y luego comprueba su cierre al reiniciarla.

## CI/CD y deployment

`.github/workflows/ci.yml` instala dependencias, ejecuta pruebas de modelos y navegador, compila y publica `dist` como artefacto. Otro trabajo obtiene GameStats como repositorio hermano, construye las imágenes, ejecuta el smoke test integrado y comprueba persistencia tras reiniciar Go. Publica también la imagen web probada.

Como son repositorios separados, configurar `GAMESTATS_REPOSITORY` (por defecto `JasonM910/GameStats`) y `GAMESTATS_REF` con la rama o commit que incluya la API. La rama predeterminada de GameStats es `master`, que también utiliza el workflow si no se configura otra referencia. La ejecución manual permite escoger `gamestats_ref`. Si ya existe una variable `GAMESTATS_REF` con valor `main`, corregirla a `master` o a un commit válido. Ambos cambios deben publicarse en ramas compatibles antes de ejecutar esa integración en GitHub. El workflow de GameStats conserva la validación por archivos y añade una validación HTTP propia.

El deployment definido es Docker Compose en el equipo o servidor elegido, actualizando ambos repositorios y ejecutando `docker compose up --build -d --wait`. No se configura un servidor remoto ni credenciales que no existan en el proyecto. Para exposición pública se requiere configurar dominio/HTTPS y el control de acceso del entorno; la API actual es para la consola local y usa un único proceso escritor sobre JSON.

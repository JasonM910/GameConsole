# Demostración: Prolog, partidas simultáneas y GameStats

## Preparación

Los repositorios `GameConsole` y `GameStats` deben estar juntos. Desde `GameConsole`:

```powershell
docker compose up --build -d --wait
docker compose ps
```

Abrir http://localhost:8088. Deben aparecer `web`, `prolog`, `gamestats` y `analyzer`. La API Go y Scala conservan su contrato; Prolog es un servicio de decisiones de GameConsole.

## 1. Ajedrez contra Prolog

1. Elegir Ajedrez, mantener «Computadora · Prolog» y crear una partida. La persona juega con blancas.
2. Mover `e2` a `e4`. Se muestra «Prolog está pensando…» y no se permite mover las negras manualmente. La respuesta se aplica automáticamente.
3. Abrir «Detalles y conexión». Mostrar la cantidad de posiciones examinadas y la profundidad de la última búsqueda.
4. Abrir Estadísticas durante una respuesta. Al volver, comprobar que la computadora completó su turno aunque la vista se desmontara.
5. Finalizar por abandono y consultar el historial. Go recibe los eventos de ambos jugadores; Scala atribuye sus jugadas y resultados a `PLAYER_WHITE` y `PROLOG`.
6. Mostrar que «Dos personas» sigue disponible para jugar localmente. Las partidas antiguas conservan ese modo.

### Explicación del algoritmo

«JavaScript envía una posición FEN: ubicación de las piezas, turno, derechos de enroque, captura al paso y contadores. No envía una jugada ya elegida. SWI-Prolog interpreta esa posición y usa hechos como `piece(Color, Tipo, Columna, Fila)` y reglas de movimiento para generar candidatos. Aplica cada movimiento y descarta los que dejan al propio rey en jaque. Incluye promoción, enroque y captura al paso.

Prolog examina dos medias jugadas con **negamax**: una jugada propia y la mejor respuesta del adversario. Al cambiar el turno invierte el signo de la evaluación. La evaluación considera material, avance de peones y centralización de caballos y alfiles; el mate tiene prioridad sobre el material. Ordena capturas y promociones primero. La **poda alfa-beta** evita explorar ramas que no pueden mejorar el resultado ya encontrado.

El servicio devuelve la jugada y datos de la búsqueda. La consola comprueba que la respuesta corresponda al mismo FEN y la valida otra vez con chess.js. Si el servicio falla, conserva el turno y ofrece reintentar; no inventa una respuesta en JavaScript. Si la persona abandona mientras Prolog calcula, se cancela la solicitud y una respuesta tardía no modifica el resultado».

Es una IA didáctica con búsqueda limitada, no un motor de nivel profesional. La aplicación termina tablas y repeticiones con las reglas de chess.js; el buscador recibe la posición FEN, sin historial de repeticiones.

Para mostrar un mate decidido por Prolog y su registro real en Scala de forma reproducible:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:8088'
$env:GAMESTATS_LIVE = '1'
# Para Edge instalado, añadir: $env:PLAYWRIGHT_CHANNEL = 'msedge'
npx playwright test e2e/prolog.spec.js --headed
```

## 2. Varias partidas y consulta durante el juego

1. Iniciar Memoria. Anotar su UUID y tiempo.
2. Volver a Consola sin pausar y crear otra Memoria. Iniciarla.
3. Volver a Consola, crear Pac-Man e iniciarlo. Abrir Estadísticas desde el juego.
4. Mostrar las tres sesiones en el panel «Partidas en ejecución». Sus relojes continúan y Pac-Man conserva su simulación y sus eventos; puede perder vidas si se deja sin control.
5. Abrir la primera Memoria desde el panel y comprobar que continúa. Pausarla explícitamente. Comprobar que las otras siguen activas.
6. Abrir otra pestaña del mismo origen y crear otra partida. Los UUID y eventos permanecen separados.
7. Abrir en esa pestaña una partida que controla la primera. Se actualiza en modo de observación. Un Web Lock por UUID impide que ambas pestañas avancen su reloj o apliquen jugadas. Al cerrar la pestaña propietaria, la otra adquiere el control y ofrece continuar la partida guardada.

Cambiar de pantalla, perder foco u ocultar una pestaña no pausa las sesiones. El navegador puede espaciar sus temporizadores; el motor usa el tiempo transcurrido para avanzar al siguiente ciclo. Una pestaña cerrada, un navegador suspendido o un equipo apagado no ejecutan juegos. Al cerrar o recargar se guardan pausadas las partidas individuales para restaurarlas con «Continuar».

## 3. Aislamiento de fallos de envío

«Cada partida mantiene una cola persistente con sus propios identificadores de eventos. Se envían hasta cuatro partidas en paralelo, con lotes de hasta cien eventos y orden secuencial dentro de cada partida. Un rechazo detiene solamente esa cola, conserva los pendientes y deja que las otras terminen. Los reintentos reutilizan los mismos IDs y las confirmaciones se guardan por separado de la posición del juego. Otro Web Lock por UUID coordina los envíos de distintas pestañas».

Mostrar la prueba que fuerza un HTTP 400 para una partida y comprueba que la siguiente recibe confirmación:

```powershell
npx playwright test e2e/simultaneous.spec.js --headed
```

Los casos simulados del navegador no añaden datos a GameStats. Los casos con `GAMESTATS_LIVE=1` y los smoke tests sí agregan partidas; conviene usar un proyecto Compose de pruebas con otro puerto y su propio volumen.

## Verificación técnica

```powershell
npm test
docker compose run --rm --no-deps prolog swipl -q -g run_tests -t halt tests.pl
$env:GAMESTATS_BASE_URL = 'http://127.0.0.1:8088'
npm run test:prolog
npm run test:integration
```

Las pruebas Prolog contrastan los movimientos con recuentos perft conocidos, incluidos enroque, clavadas y finales. La prueba HTTP valida decisiones concurrentes con chess.js. Las pruebas de navegador comprueban el turno real de Prolog, el mate, el panel Scala, varias instancias y el control entre pestañas.

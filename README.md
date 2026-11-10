# GameConsole

Primera etapa del proyecto final: una consola web en React, Vite y JavaScript. Por ahora solo Ajedrez tiene una partida funcional; Pac-Man y Carreras aparecen en el catálogo como módulos pendientes.

## Requisitos y ejecución

Se necesita Node.js 18 o posterior.

```powershell
npm install
npm run dev
```

Abrir la dirección local indicada por Vite. Para comprobar la aplicación:

```powershell
npm test
npm run build
```

## Qué incluye esta etapa

- Catálogo con Ajedrez, Pac-Man y Carreras.
- Partidas locales de Ajedrez para dos personas, con movimientos legales, promoción a elección, jaque, mate, tablas y abandono.
- Partidas independientes identificadas con UUID y persistidas en `localStorage`. Las pestañas comparten la lista, pero cada partida mantiene su propio identificador y estado.
- Estructura modular: `src/games` contiene el modelo de partida y las reglas de cada juego; `src/components` contiene la interfaz; `src/services` contiene persistencia y el adaptador de eventos.
- Pruebas automatizadas del modelo de Ajedrez y del contrato del adaptador.

El ajedrez contra computadora y la conexión con Prolog **no están implementados**. No se generan jugadas aleatorias ni se presenta el modo local como inteligencia artificial.

## Contrato de GameStats e integración pendiente

GameStats valida archivos JSON por lotes y luego produce `resultados.json` mediante Scala. No tiene API HTTP, endpoint de eventos ni endpoint de consulta de estadísticas. Por eso esta app no puede enviar eventos ni consultar resultados del GameStats original en tiempo real.

`src/services/EventAdapter.js` crea eventos con los campos y nombres admitidos por GameStats. Para CHESS valida `MATCH_STARTED`, `MOVE_PLAYED`, `PIECE_CAPTURED`, `CHECK_GIVEN`, `CHECKMATE` y `MATCH_FINISHED`, sin campos extra. El transporte asíncrono solo intenta un `POST` cuando se configura `VITE_GAMESTATS_URL`; sin esa variable marca el evento como pendiente, sin afirmar que se entregó. La URL debe ser un puente HTTP futuro que acepte un arreglo JSON de eventos. **No se debe apuntar al GameStats actual**, porque no ofrece ese servicio. No hay un endpoint predeterminado inventado.

La integración completa requiere acordar e implementar un puente entre el formato JSON por lotes de GameStats y una API; la consulta de estadísticas queda igualmente pendiente. No se duplican aquí los cálculos de Scala.

Carreras todavía no pertenece al catálogo de GameStats. Para agregarlo allí se necesitaría definir su contrato y tipos de evento en `GameStats/internal/events/schema.go`, incorporar su simulación en `GameStats/internal/simulator`, añadir su analizador en `GameStats/scala/src/main/scala/Gameanalyzers.scala` y ajustar pruebas y documentación. Esos cambios no forman parte de esta etapa y los archivos originales de GameStats no se modificaron.

## Próximas etapas

- Implementar el motor de Ajedrez en Prolog y conectarlo como oponente real.
- Implementar Pac-Man y sus eventos compatibles.
- Coordinar la extensión del contrato de GameStats para Carreras antes de generar sus eventos.
- Definir con el equipo el puente HTTP para envío y consulta; no se presupone que el procesamiento actual por lotes se vuelva tiempo real automáticamente.
- Integrar el panel de estadísticas, interfaz de Carreras y tareas de Docker, CI/CD y deployment en las etapas asignadas.

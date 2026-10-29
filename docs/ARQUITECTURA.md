# Arquitectura de la demo

## Capas

```
src/
  config/        Escenario configurable (cantidades, umbrales de reglas)
  domain/        Tipos del modelo y catálogos fijos (especies, hábitat, equipos)
  data/          Fuente de datos: hoy el simulador, mañana un servicio real
  integration/   Contratos para lecturas reales (sin implementación)
  logic/         Reglas de negocio puras: estado, métricas, alertas, filtros
  state/         Estado de la sesión y persistencia local
  components/    Componentes reutilizables (mapa, gráficas, filtros, ficha)
  features/      Una carpeta por pantalla
  app/           Rutas de Next.js (solo montan la pantalla)
```

La interfaz solo conoce `Dataset` (`src/domain/types.ts`) y el contexto de
`src/state/DemoProvider.tsx`. No sabe que los datos son simulados.

## Modelo de datos

| Entidad | Tipo | Notas |
| --- | --- | --- |
| Penguins | `Penguin` | ID único (`KNG-001`), nombre opcional (`name`), especie, alta, estado del registro, dispositivo, última revisión. |
| Species | `Species` | Seis especies con nombre en español e inglés. |
| CareTeams | `CareTeam` | Responsable, integrantes y zonas. La asignación vigente es `assignments` en el estado: un ejemplar tiene exactamente un equipo. |
| Habitats / HabitatZones | `Habitat`, `HabitatZone` | Plano 1600×1000 (40 u = 1 m), zonas por tipo y medio, áreas restringidas y puntos de referencia. |
| LocationReadings | `LocationReading` | Ejemplar, dispositivo, fecha y hora, zona, coordenadas, precisión (m), fuente, calidad, medio y `simulated`. |
| — | `ReadingGap` | Huecos con su causa: `no_fix` (sin posición) o `no_comm` (sin comunicación). |
| ActivityRecords | `ActivityRecord` | Tramos continuos en una zona y medio, derivados de las lecturas. |
| CareTasks | `CareTask` | Tipo, equipo, ejemplar o zona, fechas, estado e historial. |
| Alerts | `Alert` | Tipo, prioridad, regla que la generó, equipo, estado e historial de resolución. |
| CareObservations | `CareNote` | Observación operativa con autor y fecha. `simulated: true` las del escenario; `false` las que registra el usuario (`userNotes` en el estado, persistidas). Los registros veterinarios van aparte y no existen en la demo. |

### Cambios del módulo de especie y ficha individual

- `Penguin.name` es opcional y compatible con datos sin nombre. El simulador lo
  asigna con un generador aparte (`namesFor`), así que las lecturas de una misma
  semilla no cambian.
- `CareNote.simulated` pasó de `true` a `boolean` para admitir observaciones
  registradas por el usuario. `PersistedState.userNotes` es opcional: un estado
  guardado antes de este cambio se sigue cargando.
- `PERMISSIONS` (en `DemoProvider`) concentra lo que el usuario puede editar:
  reasignar equipo, registrar observaciones y gestionar alertas. Hoy es fijo;
  con autenticación real vendrá del rol.
- Care Teams: `CareTeam.active` (ausente = activo) y `CareTeam.roles` son opcionales. Los
  equipos creados (`customTeams`) y las ediciones (`teamEdits`) viven en el estado y
  se mezclan con los del escenario; `dataset.teams` del contexto ya trae el resultado.
  Cada cambio queda en `teamLog`. Desactivar no borra ni reasigna.
- `Shift` (turnos): la demo no trae ninguno; solo existen si alguien los configura.
- `TaskStatus` suma `cancelled` y `CareTask.assignee` (persona a cargo). Qué cuenta
  como abierta, la prioridad derivada del vencimiento y el cumplimiento están en
  `src/logic/tasks.ts`.
- Rutas: `/teams/[id]?tab=…` (detalle por pestañas) y `/map?team=ID`.
- Rutas nuevas: `/species/[id]` (detalle y tabla de ejemplares; el estado de la
  tabla vive en la URL) y `/map?species=ID` (abre el mapa filtrado).

Todos los agregados (`src/logic/metrics.ts`) se calculan desde las lecturas y
los huecos; ninguna cifra está escrita a mano.

## Reglas de alerta

`src/logic/alertRules.ts`, umbrales en `DemoConfig.rules`:

1. **Lectura desactualizada**: el dispositivo comunica, pero no hay posición en
   más de N minutos.
2. **Dispositivo sin comunicación**: sin latido en más de N horas.
3. **Revisión de cuidado pendiente**: más de N días desde la última revisión.
4. **Tarea vencida**: tarea abierta con fecha límite pasada.
5. **Revisión solicitada por el equipo**: una persona marcó al ejemplar.

Ninguna regla usa desviaciones de actividad ni infiere salud.

## Puntos de integración futura

1. **Fuente de datos** — `src/data/source.ts` define `PenguinDataSource`.
   Una implementación `live` entregaría el mismo `Dataset` desde un servicio
   propio. Para pasar a datos reales se cambia la fuente en
   `DemoProvider`; las pantallas no cambian.
2. **Ingesta de lecturas** — `src/integration/ingest.ts` define `RawReading`,
   `DeviceHeartbeat`, `ReadingAdapter` (uno por proveedor) y
   `normalizeReading`, que convierte cualquier lectura cruda al modelo o
   explica por qué la rechaza.
3. **Persistencia** — hoy `localStorage`. En producción, reasignaciones,
   tareas y estados de alerta irían a una base de datos con usuarios reales.

Supuestos a validar con proveedores y en el hábitat real:

- GPS convencional no sirve bajo el agua ni bajo techo. Se contempla una red
  local en tierra (p. ej. UWB) y receptores acústicos en agua con precisión de
  zona.
- El medio agua/tierra se infiere mejor con un sensor de inmersión que con la
  posición.
- Las compuertas RFID solo confirman el paso por un punto conocido.
- Sin cámaras ni reconocimiento visual en esta fase.

## Aviario (oct-2026)

La interfaz pasó a inglés y se agregó el área del aviario. Las alertas y tareas
operativas ya no existen; en su lugar hay **reglas propuestas**
(`src/features/rules/`), ejemplos configurables que muestran a qué animales de
la demo aplicarían, rotulados "Proposed · not active". Ninguna regla habla de
fallas de dispositivo.

| Capa | Archivo | Notas |
| --- | --- | --- |
| Dominio | `src/domain/aviary.ts` | `AviarySpecies` (estado de presencia, conteo confirmado `null` hasta que SeaWorld lo dé, `SourceRef` con fecha de publicación y de consulta), zonas ilustrativas, equipos ficticios, `Bird`, `BirdObservation`. |
| Datos | `src/data/aviarySimulate.ts` | 500 registros que representan la estimación ≈500; avistamientos manuales a nivel zona. |
| Lógica | `src/logic/aviary.ts` | Último avistamiento, días sin verlo, movimientos entre avistamientos consecutivos (el momento exacto se desconoce), conteos. |
| Estado | `src/state/useAviary.ts` | Un dataset por "ahora" de la demo, compartido por todas las pantallas. |

Para pasar a datos reales del aviario basta reemplazar `generateAviary` por una
fuente que entregue `AviaryDataset` y llenar `confirmedCount`/`source` de cada
especie con lo que envíe SeaWorld (`INVENTORY_REQUEST`).

## Monitor 3D del aviario (oct-2026)

Rutas `/aviary` (Overview) y `/aviary/map` (Habitat map), con la misma estructura
que el área de pingüinos. Es la única fuente de datos del aviario: el registro,
Species y las reglas usan los mismos 500 ejemplares. Todo es **DEMO**.

| Archivo | Qué contiene |
| --- | --- |
| `src/domain/aviaryTracking.ts` | Tipos y relaciones: especie → ave → estancias (`Stay`, siempre ligadas a un árbol existente) → detecciones. Zonas Z1–Z7 conceptuales, niveles de altura provisionales y la interfaz `TrackingSource`. |
| `src/data/aviaryCatalog.ts` | Las 32 especies (nombre en inglés y español, científico, código, grupo) y las cantidades pedidas. `adjustToTotal` comprueba la suma y la corrige a 500 por resto mayor. |
| `src/data/aviaryTrackingSimulate.ts` | `generateRegistry` (aves con edad, sexo cuando aplica, dispositivo; árboles con puntos de referencia), `buildTimeline` (estancias por ave, deterministas por semilla) y la `TrackingSource` simulada. |
| `src/data/aviaryDemoStore.ts` | Persistencia: el registro se guarda en `localStorage` la primera vez y se relee después; nunca se duplica. También guarda el reloj simulado. |
| `src/state/useTracking.ts` | Carga el registro una vez por sesión, `resetDemoData` y `useSimClock` (reloj simulado con play/pausa y velocidad). |
| `src/logic/aviaryTracking.ts` | Estado de la ubicación, calidad, historial, ocupantes de un árbol, movimientos recientes y actividad por hora. |
| `src/logic/aviaryDemoChecks.ts` | Validaciones obligatorias (32 especies, 500 aves, IDs únicos, árboles existentes, alturas coherentes, sin duplicados, persistencia). Se muestran en el monitor y en Inventory. |
| `src/features/aviary/` | `AviaryOverview`, `AviaryMapView`, `BirdRegistry`, `AviaryInventory` (Species). En `monitor/`: escena three.js (`AviaryScene`), piezas compartidas (`AviaryParts`) y vista lateral del árbol. |

Coordenadas: X/Y en el plano y Z = altura (internamente `x`, `z` y `y` de three.js).

Reglas que respeta el modelo:

- Una detección de zona (dispositivo con señal intermitente) o desconocida **nunca**
  lleva coordenadas ni árbol, y no se dibuja como punto.
- El árbol se reporta solo si la incertidumbre cabe en la copa; la rama **nunca**.
- El movimiento sale de la línea de tiempo: con el reloj avanzando, solo cambian
  las aves que terminan una estancia. El trayecto dura según la distancia (vuelo
  ~2–3.5 m/s en arco, caminata ~0.6 m/s en el suelo) y en el mapa cada punto se
  desliza cuadro a cuadro hacia su posición ("Smooth motion").

Para conectar datos reales basta implementar `TrackingSource` (`latest`,
`history`) sobre la API de rastreadores o cámaras y cargar especies, aves y
árboles desde el inventario real en lugar de `generateRegistry`.

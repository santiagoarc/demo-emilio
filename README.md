# Animal Care Platform — demo para SeaWorld Abu Dhabi

Demo web para presentar a SeaWorld un concepto de consulta y seguimiento de
animales: **pingüinos** y **aviario**. La interfaz está en **inglés** porque se
presenta a responsables de SeaWorld.

**Todo es simulado**: no hay dispositivos, APIs ni proveedores conectados, y
ninguna cifra es inventario real. Lo único con fuente son los nombres de
especies que SeaWorld Abu Dhabi publica (ver abajo).

## Ejecutar

```bash
npm install
npm run dev:webpack -- -p 3020   # http://localhost:3020
```

En esta máquina Windows bloquea Turbopack, por eso `dev:webpack`. En otra
máquina `npm run dev` también sirve. Producción local: `npm run build && npm start`.

No requiere variables de entorno. Opcional: `ANTHROPIC_API_KEY` en
`.env.local` hace que el chat de reportes use Claude; sin ella responde con los
datos del sistema.

## Estructura de la app

La barra lateral cambia entre **Penguins** y **Aviary** y se puede plegar a solo iconos (*Collapse menu*) para dar más espacio al mapa.

| Área | Ruta | Qué muestra |
| --- | --- | --- |
| | `/` | Redirige a Penguins. |
| | `/roadmap` | Estado de los datos, *Potential capabilities* (salud, comportamiento, alimentación, reproducción, asignación) y *Technology to validate*. |
| **Penguins** | `/penguins/overview` | Indicadores, especies, zonas y actividad. |
| | `/map` | Mapa del hábitat, recorrido y paradas numeradas de un ejemplar. El recorrido es una línea discontinua cuyas rayas avanzan en el sentido en que se movió el animal (también en el aviario: imagen, 3D y vista superior, en el color de la especie). |
| | `/species`, `/penguins`, `/penguins/[id]`, `/teams` | Especies, registro, ficha individual y equipos. |
| | `/health` | Seguimiento de casos (simulados) y chequeo de actividad (inferencia, no diagnóstico). |
| | `/analytics` | Agua vs. tierra, actividad por hora, mapa de calor de la semana, movimientos entre zonas. |
| | `/penguins/rules` | Reglas propuestas (ejemplos configurables, no alertas operativas). |
| **Aviary** | `/aviary/map` | **Map**: mapa grande con la columna derecha de **especies** (~10 visibles) y **equipos** debajo. Sobre la imagen, modo **Areas** (por defecto): cada zona con su total, mezcla de especies y aves sin señal; al elegir una zona se ven sus puntos y una ficha con quiénes están (modo **Birds** = todos los puntos). Vista por defecto **Image** = la imagen de referencia del aviario (`public/aviary/rainforest-reference.png`) con las aves y los árboles proyectados encima (posiciones aproximadas, `src/domain/aviaryImageProjection.ts`); además, el aviario reconstruido a partir del render de referencia (domo geodésico, árbol central con plataformas, pasarelas elevadas, lagunas, cascadas y rocas; `src/domain/aviaryLayout.ts`) en **vista 3D** y **vista superior 2D** del mismo modelo (mismos árboles e IDs; filtros y selección se conservan al cambiar). En 3D y 2D el mapa arranca **sin puntos**: se muestran solo los de la especie, el equipo, la zona o el estado que se elija (tarjeta «Choose which birds to show», filtros de arriba o listas de la derecha), más el ave abierta. Cada ave es un **punto pequeño del color de su especie** (32 colores únicos); los puntos que se enciman se agrupan con un número y se separan al acercar, y si comparten punto aun al máximo zoom se listan. Leyenda de especies a la izquierda (clic = filtra), 10 equipos a la derecha, ficha compacta del árbol y vista vertical, botón **Maximise**. La ficha de cada ave tiene la pestaña **Activity** (equivalente a «How is it doing?» de pingüinos): tiempo volando / caminando / en árboles / en el suelo, distancia volada y caminada, vuelos, vuelo más largo, velocidad media, punto más alto y árboles visitados (6 h · 24 h · 7 días), comparado con su especie y con sus propios días anteriores, y minutos de vuelo por día (`src/logic/aviaryActivity.ts`). Las distancias siguen el mismo recorrido que dibuja el mapa; con dispositivo de solo zona no se muestran. Los filtros (zona, nivel, estado, especie, equipo) son pastillas compactas en el encabezado, combinables, teñidas cuando filtran y con «Clear»; ya no hay reloj visible (el tiempo avanza solo). |
| | `/aviary/species` | **Species**: lista compacta de las 32 especies (foto, nombre, número de aves y estado de monitoreo; el nombre científico como segunda línea). Al elegir una se ven sus aves, con acceso al mapa filtrado, a la ficha de la especie y a la ficha de cada ave. Abajo, las validaciones de los datos y el reinicio. |
| | `/aviary/species/[id]` | Ficha de la especie: foto de referencia (Wikimedia Commons, con autor y licencia), resumen de Wikipedia, cifras y una tarjeta por cada ave. |
| | `/aviary/birds` | **Individuals**: la tabla del registro de pingüinos para las 500 aves (equipo, última ubicación, última detección con precisión y confianza, estado); cada fila abre su ficha. |
| | `/aviary/birds/[id]` | **Ficha individual** con la estructura de la de pingüinos: indicadores, Health (chequeo de actividad + seguimientos), ubicación con recorrido sobre la imagen, actividad (volando, posado, sin movimiento, en movimiento, por hora, por día y por nivel de altura, comparada con el periodo anterior), historial de detecciones, equipo con reasignación, historial de cambios y observaciones. Lo que el dispositivo no puede medir sale como «Not available». |
| | `/aviary/teams` | **Care teams**: la pantalla de equipos de pingüinos (mismas tarjetas, indicadores y gráficas) para los 10 equipos de 50 aves; `/aviary/teams/[id]` con pestañas Overview, Birds (tabla con resumen y reasignación) y Staff. |
| | `/aviary/health` | **Health follow-up**: como Health de pingüinos: seguimientos abiertos en filas compactas (prioridad, motivo, estado, última actualización), chequeo de actividad de cada ave y panel de detalle con actividad, árboles visitados, observaciones, bitácora y cambio de prioridad o de próxima revisión. Son indicaciones para revisar, nunca diagnósticos. `/aviary`, `/aviary/trees`, `/aviary/rules` y `/aviary/reports` redirigen. |

## Datos: simulado, con fuente y pendiente

| Dato | Estado |
| --- | --- |
| 6 especies de pingüino | Fuente: [SeaWorld Abu Dhabi, 10-abr-2023](https://seaworldabudhabi.com/en/news/tropical-ocean-reveal), consultada el 27-oct-2026. |
| 206 pingüinos y su reparto | Cifra de la demo, por confirmar. |
| Grupos del aviario (tucanes, loros, flamenco del Caribe) | Misma fuente. No publica lista de especies ni cantidades. |
| 32 especies y 500 aves del aviario | **Demo**: catálogo y cantidades elegidos para la presentación; aves, edades, sexos, dispositivos, árboles, posiciones y movimientos son ficticios. La tabla pedida sumaba 503 y se ajusta sola a 500. |
| Lecturas, avistamientos, casos de salud, equipos y personas | Simulados. |

El aviario es una **demo con datos simulados**: el movimiento corre sobre un reloj
simulado y no representa rastreo real en tiempo real.

## Imágenes de especies

Las miniaturas de `public/aviary/species/` son copias (330 px) de fotos de
Wikimedia Commons con licencias libres; autor, licencia y enlace de cada una están
en `src/data/aviarySpeciesInfo.ts` y se muestran en la ficha de cada especie. El
recorte circular de cada foto se ajusta en `src/data/aviarySpeciesIcons.ts`.
Los nombres de árbol (Ceiba, Mango…) son ilustrativos de la demo. En el mapa no se usan fotos: cada especie tiene un color exclusivo (`src/data/aviaryCatalog.ts`).

## Equipos del aviario

Diez equipos (Alpha … Juliet). El reparto por defecto ordena las aves por grupo y
especie y las parte en bloques de 50 (`src/data/aviaryTeams.ts`): cada equipo sigue
2–5 especies relacionadas y cada ave está en un solo equipo. Las reasignaciones
hechas en pantalla se guardan en el `localStorage` (`aviary-demo/teams/v2`).

## Escenario de demostración

- Pingüinos: `src/config/demo.config.ts` (cantidades por especie, días de
  historia, frecuencia de lecturas). Desde la app: **Demo scenario & reset**.
- Aviario: `src/data/aviaryCatalog.ts` (32 especies y cantidades) y
  `src/data/aviaryTrackingSimulate.ts` (aves, árboles y movimientos). El registro
  se genera una sola vez y se guarda en el `localStorage` del navegador
  (`aviary-demo/registry/v1`, reloj en `aviary-demo/clock/v1`); **Reset demo data**
  en el monitor lo vuelve a generar.
- La misma semilla genera siempre el mismo escenario. Lo que edita el usuario
  se guarda en el `localStorage` del navegador (`penguin-demo/v2`).

Estructura de datos y puntos de integración: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

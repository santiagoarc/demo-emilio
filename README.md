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

La barra lateral cambia entre tres áreas:

| Área | Ruta | Qué muestra |
| --- | --- | --- |
| **Overview** | `/` | Resumen de ambas áreas, qué datos son simulados, cuáles tienen fuente y cuáles faltan. |
| | `/roadmap` | Estado de los datos, *Potential capabilities* (salud, comportamiento, alimentación, reproducción, asignación) y *Technology to validate*. |
| **Penguins** | `/penguins/overview` | Indicadores, especies, zonas y actividad. |
| | `/map` | Mapa del hábitat, recorrido y paradas numeradas de un ejemplar. |
| | `/species`, `/penguins`, `/penguins/[id]`, `/teams` | Especies, registro, ficha individual y equipos. |
| | `/health` | Seguimiento de casos (simulados) y chequeo de actividad (inferencia, no diagnóstico). |
| | `/analytics` | Agua vs. tierra, actividad por hora, mapa de calor de la semana, movimientos entre zonas. |
| | `/penguins/rules` | Reglas propuestas (ejemplos configurables, no alertas operativas). |
| **Aviary** | `/aviary` | Monitor 3D (three.js): mapa conceptual con árboles T1…, niveles de altura, 500 aves por estado, ficha del ave y del árbol (con vista lateral), historial, filtros, reloj simulado con movimiento gradual, feed de movimientos y validaciones de los datos. |
| | `/aviary/birds` | Tabla de las 500 aves con búsqueda y filtros; cada fila abre el ave en el monitor (`/aviary?bird=ID`). |
| | `/aviary/inventory` | Catálogo de 32 especies con cantidades (pedidas vs. generadas), sexo y edad; inventario de árboles; validaciones. |
| | `/aviary/rules` | Reglas propuestas del aviario. |

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

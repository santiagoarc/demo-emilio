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
| **Aviary** | `/aviary` | Aves registradas en la demo vs. estimación ≈500, especies, distribución por zona y equipo. |
| | `/aviary/birds`, `/aviary/birds/[id]` | Búsqueda y perfil con avistamientos y movimientos entre zonas. |
| | `/aviary/habitat` | Plano ilustrativo por zonas, coloreado por último avistamiento. |
| | `/aviary/inventory` | Esqueleto del inventario con fuente, conteo confirmado ("To be confirmed") y lo que SeaWorld debe enviar. |
| | `/aviary/rules` | Reglas propuestas del aviario. |

## Datos: simulado, con fuente y pendiente

| Dato | Estado |
| --- | --- |
| 6 especies de pingüino | Fuente: [SeaWorld Abu Dhabi, 10-abr-2023](https://seaworldabudhabi.com/en/news/tropical-ocean-reveal), consultada el 27-oct-2026. |
| 206 pingüinos y su reparto | Cifra de la demo, por confirmar. |
| Grupos del aviario (tucanes, loros, flamenco del Caribe) | Misma fuente. No publica lista de especies ni cantidades. |
| ≈500 aves | Estimación de la reunión, por confirmar. La demo genera 500 registros que solo la representan. |
| Lecturas, avistamientos, casos de salud, equipos y personas | Simulados. |

El aviario **no asume chips ni ubicación en vivo**: los datos son avistamientos
manuales de cuidadores a nivel zona. La ubicación en tiempo real aparece solo
como "Future integration preview", rotulada como por validar.

## Escenario de demostración

- Pingüinos: `src/config/demo.config.ts` (cantidades por especie, días de
  historia, frecuencia de lecturas). Desde la app: **Demo scenario & reset**.
- Aviario: `src/domain/aviary.ts` (especies, zonas configurables, equipos,
  fuente) y `src/data/aviarySimulate.ts` (roster y avistamientos).
- La misma semilla genera siempre el mismo escenario. Lo que edita el usuario
  se guarda en el `localStorage` del navegador (`penguin-demo/v2`).

Estructura de datos y puntos de integración: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

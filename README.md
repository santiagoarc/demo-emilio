# Penguin Tracking & Care — demo

Demo web para presentar a SeaWorld un concepto de monitoreo, localización y
gestión de pingüinos. **Todo es simulado**: no hay dispositivos, APIs ni
proveedores conectados, y ninguna cifra refleja el inventario real.

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:3000
```

Producción local: `npm run build && npm start`.

No requiere variables de entorno ni credenciales.

## Qué incluye

| Pantalla | Ruta | Para qué |
| --- | --- | --- |
| Penguin Operations Overview | `/` | Indicadores, especies, zonas, actividad por hora, alertas y últimos movimientos. Todo reacciona a los filtros. |
| Habitat Map | `/map` | Mapa interactivo: zoom, arrastre, capas, filtros, selección de zona y ejemplar, panel lateral y línea de tiempo de 24 h. |
| Species | `/species` | Las seis especies con totales calculados, ubicación reciente, zonas, tiempo agua/tierra y equipos. |
| Penguins | `/penguins` | Registro completo con búsqueda, estado y orden. |
| Ficha individual | `/penguins/[id]` | Identificación, localización, actividad, comparación de periodos, operación, observaciones e incidencias. |
| Care Teams | `/teams` | Fichas de equipo, mapa de sus ejemplares, reasignación, tareas, alertas y actividad. |
| Activity Analytics | `/analytics` | Agua vs. tierra, actividad por hora, mapa de calor, movimientos entre zonas, comparación por especie y equipo, evolución diaria e historial de un ejemplar. |
| Alerts & Tasks | `/alerts` | Alertas por reglas, cambio de estado con historial, asignación a equipos y creación de tareas. |

Atajo: `Ctrl K` busca cualquier ejemplar.

## Escenario de demostración

- Configuración en `src/config/demo.config.ts`: ejemplares por especie (206 por
  omisión), días de historia, frecuencia de lecturas, mezcla de conectividad y
  umbrales de las reglas de alerta.
- Desde la app: **Escenario y reinicio de la demo** (abajo a la izquierda)
  permite cambiar las cantidades por especie y la semilla, o volver al
  escenario inicial.
- La misma semilla genera siempre el mismo escenario. Los datos se generan en
  el navegador con la hora actual como "ahora".
- Las reasignaciones, tareas y estados de alertas se guardan en el
  `localStorage` del navegador y sobreviven a recargas. Las lecturas no se
  guardan: se regeneran desde la semilla.

## Reglas de honestidad de los datos

- Las posiciones del mapa son lecturas simuladas tal como se "registraron".
  Al reproducir la línea de tiempo, el punto se desliza entre dos lecturas
  consecutivas como animación visual (rotulada en pantalla y desactivable con
  "Movimiento suave"); si entre ellas hay un hueco, se queda en su última
  ubicación conocida. Las líneas del recorrido solo unen lecturas consecutivas.
- Bajo el agua no se asume GPS: la fuente es un receptor acústico con
  precisión de zona (el radio se dibuja en el mapa).
- El tiempo sin lectura se reporta aparte y se distingue entre **sin posición**
  (el dispositivo comunica) y **sin comunicación** (el dispositivo no responde).
  "Sin movimiento registrado" describe lecturas repetidas, no inmovilidad.
- Las alertas son operativas y salen de reglas explícitas. No hay
  diagnósticos, estados clínicos ni recomendaciones veterinarias. Las
  observaciones de cuidado se marcan como registros ficticios.

Estructura de datos y puntos de integración: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

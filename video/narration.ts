export const narrationSections = [
  [
    'Este proyecto es SuperCool Ledger, un servicio pequeño para manejar saldos.',
    'La idea es sencilla: aunque dos solicitudes lleguen al mismo tiempo, el dinero no puede desaparecer, duplicarse ni gastarse dos veces.',
  ],
  [
    'La fuente de verdad es un ledger inmutable de partida doble.',
    'El saldo guardado hace rápidas las lecturas, pero los asientos y el saldo cambian dentro de la misma transacción de PostgreSQL.',
    'La base de datos rechaza cualquier movimiento descuadrado y no permite editar ni borrar el historial.',
  ],
  ['Todo vive en una aplicación de TypeScript y Fastify, con PostgreSQL como única autoridad.'],
  [
    'El JWT define el tenant y los permisos.',
    'Los esquemas validan cada solicitud.',
    'Transferencias es el único módulo que mueve dinero. Conciliación recalcula los saldos desde los asientos.',
  ],
  [
    'Para transferir, primero se reclama una clave de idempotencia del tenant.',
    'Después se bloquean las dos cuentas siguiendo siempre el mismo orden.',
    'Con los bloqueos activos, se revisan propiedad, moneda, estado y fondos disponibles.',
    'La transferencia, los dos asientos, los saldos, el evento de auditoría y la respuesta se confirman juntos.',
  ],
  ['Esta demostración se ejecutó contra PostgreSQL real.'],
  [
    'Una transferencia de doscientos cincuenta dólares respondió con HTTP doscientos uno.',
    'Al repetir la misma clave, regresó la misma transferencia, sin un segundo efecto financiero.',
    'Un gasto mayor al saldo respondió con fondos insuficientes.',
  ],
  [
    'Los dos asientos suman cero, y la conciliación encontró cero diferencias en las tres cuentas.',
    'La operación también deja evidencia.',
  ],
  [
    'Los registros estructurados omiten payloads y campos financieros sensibles.',
    'Las métricas de Prometheus usan etiquetas acotadas.',
    'OpenTelemetry sigue las solicitudes y las operaciones financieras. Los errores inesperados pueden llegar a Sentry, mientras que un rechazo de negocio sigue siendo una respuesta normal.',
  ],
  [
    'El repositorio incluye el contrato OpenAPI, migraciones, pruebas de concurrencia, Docker, infraestructura de Render, decisiones de arquitectura, modelo de amenazas, guía operativa y el registro visible del uso de inteligencia artificial.',
    'El resultado apuesta por la evidencia: un servicio pequeño cuyas garantías se pueden leer, ejecutar y poner a prueba.',
  ],
] as const;

export const narrationSegments = narrationSections.flat();

export const narrationText = narrationSegments.join('\n\n');

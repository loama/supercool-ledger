export const narrationSections = [
  [
    'SuperCool Ledger promete que el dinero no desaparece, no se duplica y no se gasta dos veces.',
    'La garantía vive en PostgreSQL, no en la memoria del proceso.',
  ],
  [
    'El ledger usa partida doble y exige que cada journal_transaction cierre en cero.',
    'Los postings son inmutables y comparten una sola moneda.',
    'accounts.balance_minor cambia con los asientos dentro de la misma transacción.',
  ],
  [
    'El mapa comienza en src/server.ts y src/app.ts, las entradas de Fastify.',
    'src/transfers/service.ts y src/accounts/repository.ts contienen las reglas del dominio.',
    'migrations/ protege la base, scripts/demo-capture.ts captura video/assets/demo-run.json y docs/operations.md guía la operación.',
  ],
  [
    'Fastify recibe la solicitud en src/app.ts y src/auth/plugin.ts valida tenant y permisos.',
    'Los esquemas TypeBox de src/transfers/schemas.ts validan el cuerpo antes del servicio.',
    'El servicio abre una transacción de PostgreSQL, mientras registros, métricas y trazas observan el resultado.',
  ],
  [
    'src/transfers/service.ts reclama primero la clave de idempotencia del tenant.',
    'Después, ORDER BY id FOR UPDATE bloquea ambas cuentas por UUID ascendente.',
    'Con los bloqueos, valida propiedad, moneda, estado y fondos.',
    'Transferencia, postings, saldos, auditoría y respuesta confirman juntos o revierten juntos.',
  ],
  [
    'La tabla tenants contiene accounts y transfers, y cada transferencia apunta a journal_transactions.',
    'postings forma el historial financiero y audit_events registra el resultado.',
    'sandbox_sessions aísla sesiones sintéticas que expiran sin tocar clientes persistentes.',
  ],
  [
    'Abre /sandbox y crea la sesión con POST /v1/sandbox/sessions.',
    'Ejecuta, en orden, transferencia exitosa, repetición segura, conflicto de idempotencia, fondos insuficientes y carrera concurrente.',
    'Termina con asientos inmutables y conciliación, mediante GET /v1/accounts/:accountId/entries y GET /v1/operations/reconciliation.',
  ],
  [
    'scripts/demo-capture.ts ejecutó Fastify contra PostgreSQL y guardó video/assets/demo-run.json.',
    'La transferencia de doscientos cincuenta dólares respondió 201, y la repetición devolvió 200.',
    'El rechazo fue 422, los postings sumaron cero y la conciliación encontró cero diferencias en las tres cuentas.',
  ],
  [
    'infra/aws distribuye un Application Load Balancer, ECS Fargate y RDS PostgreSQL 17 en dos zonas de disponibilidad.',
    'Las tareas y el escritor viven en subredes privadas, con un NAT compartido y sin réplica de lectura.',
    'Con bootstrap_mode en true, Terraform omite el servicio hasta completar la migración.',
    'La tarea separada usa el mismo digest de imagen y DATABASE_URL para ejecutar bun run db:migrate.',
    'Debe terminar con código cero antes de cambiar bootstrap_mode a false.',
  ],
  [
    'Para revisar, empieza en el sandbox publicado y continúa por /docs, la referencia OpenAPI.',
    'Después ejecuta las pruebas y abre los archivos citados, README.md conecta cada afirmación con código y evidencia.',
  ],
] as const;

export const narrationSegments = narrationSections.flat();

export const narrationText = narrationSections.map((section) => section.join(' ')).join('\n\n');

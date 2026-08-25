export interface CaptionCue {
  from: number;
  to: number;
  text: string;
}

export const captionCues: CaptionCue[] = [
  {
    from: 0,
    to: 170,
    text: 'SuperCool Ledger is a deliberately narrow account balance service.',
  },
  {
    from: 170,
    to: 360,
    text: 'Its promise is simple: money cannot disappear, duplicate, or be spent twice when requests race.',
  },
  {
    from: 360,
    to: 535,
    text: 'Immutable double entry postings are the source of truth.',
  },
  {
    from: 535,
    to: 755,
    text: 'Cached balances exist for fast reads, but every posting and balance update commits in the same PostgreSQL transaction.',
  },
  {
    from: 755,
    to: 930,
    text: 'Database constraints reject an unbalanced journal, and posted history cannot be changed or deleted.',
  },
  {
    from: 930,
    to: 1080,
    text: 'The service is one TypeScript and Fastify application with one PostgreSQL authority.',
  },
  {
    from: 1080,
    to: 1215,
    text: 'Authentication establishes the tenant and scopes.',
  },
  { from: 1215, to: 1350, text: 'Route schemas validate the contract.' },
  {
    from: 1350,
    to: 1470,
    text: 'The transfer module owns the only money movement path. Reconciliation independently derives balances from postings.',
  },
  {
    from: 1470,
    to: 1640,
    text: 'A transfer first claims its tenant scoped idempotency key.',
  },
  {
    from: 1640,
    to: 1810,
    text: 'It then locks both accounts in sorted identifier order.',
  },
  {
    from: 1810,
    to: 1970,
    text: 'Only after those locks are held does it validate ownership, currency, account state, and available funds.',
  },
  {
    from: 1970,
    to: 2130,
    text: 'The transfer, two balanced postings, cached balances, audit event, and stored response commit together.',
  },
  { from: 2130, to: 2250, text: 'This demonstration ran against real PostgreSQL.' },
  {
    from: 2250,
    to: 2390,
    text: 'A transfer of two hundred fifty dollars returned created.',
  },
  {
    from: 2390,
    to: 2540,
    text: 'Repeating the same key returned the same transfer with no second financial effect.',
  },
  { from: 2540, to: 2640, text: 'An overspend returned insufficient funds.' },
  {
    from: 2640,
    to: 2820,
    text: 'The two postings sum to zero, and reconciliation found zero discrepancies across all three demo accounts.',
  },
  { from: 2820, to: 2945, text: 'Operational evidence is part of the design.' },
  {
    from: 2945,
    to: 3090,
    text: 'Structured logs omit payloads and sensitive financial fields.',
  },
  { from: 3090, to: 3205, text: 'Prometheus metrics use bounded labels.' },
  {
    from: 3205,
    to: 3390,
    text: 'OpenTelemetry traces cover requests and financial operations. Unexpected exceptions can flow to Sentry, while expected business rejection remains a normal response.',
  },
  {
    from: 3390,
    to: 3710,
    text: 'The repository includes the OpenAPI contract, migration and concurrency tests, Docker delivery, a Render Blueprint, architecture decisions, threat model, operations guide, and the complete visible AI interaction record.',
  },
  {
    from: 3710,
    to: 4050,
    text: 'The result favors proof over breadth: a small service whose critical claims can be read, run, and challenged.',
  },
];

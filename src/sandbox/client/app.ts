interface SandboxAccount {
  id: string;
  name: string;
  currency: 'USD' | 'MXN';
  balance: string;
}

interface SandboxSession {
  tenantId: string;
  token: string;
  expiresAt: string;
  accounts: SandboxAccount[];
}

interface ApiResult<T> {
  status: number;
  ok: boolean;
  replayed?: boolean;
  body: T;
}

interface TransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  currency: 'USD';
}

interface TransferResponse {
  id?: string;
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  amount?: string;
  currency?: string;
}

interface AccountEntries {
  entries: unknown[];
  nextCursor: string | null;
}

interface Reconciliation {
  checkedAccounts: number;
  discrepancies: unknown[];
}

interface ClientState {
  session: SandboxSession | null;
  accounts: SandboxAccount[];
  lastTransfer: { key: string; body: TransferRequest } | null;
  busy: boolean;
  timer: ReturnType<typeof setInterval> | null;
}

interface EvidenceFact {
  label: string;
  value: string;
  tone?: 'success' | 'error';
}

interface EvidenceOptions {
  method?: 'GET' | 'POST';
  path?: string;
  summary?: string;
  facts?: EvidenceFact[];
  raw?: unknown;
  statusText?: string;
}

type ElementConstructor<T extends Element> = new () => T;

const requiredElement = <T extends Element>(
  selector: string,
  constructor: ElementConstructor<T>,
): T => {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) throw new Error(`missing_sandbox_element:${selector}`);
  return element;
};

const state: ClientState = {
  session: null,
  accounts: [],
  lastTransfer: null,
  busy: false,
  timer: null,
};

const elements = {
  start: requiredElement('#start-button', HTMLButtonElement),
  reset: requiredElement('#reset-button', HTMLButtonElement),
  serviceState: requiredElement('#service-state', HTMLElement),
  serviceStateDot: requiredElement('#service-state-dot', HTMLElement),
  serviceStateLabel: requiredElement('#service-state-label', HTMLElement),
  status: requiredElement('#session-status', HTMLElement),
  time: requiredElement('#session-time', HTMLElement),
  accounts: requiredElement('#accounts-grid', HTMLElement),
  evidence: requiredElement('#evidence-stream', HTMLElement),
  actions: [...document.querySelectorAll<HTMLButtonElement>('[data-action]')],
};

const randomKey = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

const setBusy = (busy: boolean): void => {
  state.busy = busy;
  document.body.dataset.busy = String(busy);
  elements.start.disabled = busy || Boolean(state.session);
  elements.reset.disabled = busy || !state.session;
  for (const button of elements.actions) {
    button.disabled = busy || !state.session;
  }
};

const setSessionExpired = (): void => {
  state.session = null;
  state.lastTransfer = null;
  elements.status.textContent = 'Session expired';
  elements.time.textContent = '00:00';
  elements.start.textContent = 'Create test account';
  elements.start.disabled = false;
  elements.reset.disabled = true;
  for (const button of elements.actions) button.disabled = true;
};

const updateCountdown = (): void => {
  const session = state.session;
  if (!session) return;
  const remaining = Math.max(0, new Date(session.expiresAt).getTime() - Date.now());
  if (remaining === 0) {
    setSessionExpired();
    return;
  }
  const totalSeconds = Math.floor(remaining / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  elements.time.textContent = `${minutes}:${seconds}`;
};

const startCountdown = (): void => {
  if (state.timer !== null) clearInterval(state.timer);
  updateCountdown();
  state.timer = setInterval(updateCountdown, 1_000);
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> => {
  const headers = new Headers(options.headers);
  if (state.session && path !== '/v1/sandbox/sessions') {
    headers.set('authorization', `Bearer ${state.session.token}`);
  }
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 401 && state.session) setSessionExpired();
  return {
    status: response.status,
    ok: response.ok,
    replayed: response.headers.get('idempotent-replayed') === 'true',
    body: body as T,
  };
};

const checkReadiness = async (): Promise<void> => {
  try {
    const response = await fetch('/health/ready', {
      headers: { accept: 'application/json' },
    });
    const body = (await response.json().catch(() => null)) as { status?: string } | null;
    const ready = response.ok && body?.status === 'ready';
    elements.serviceState.dataset.state = ready ? 'ready' : 'unavailable';
    elements.serviceStateLabel.textContent = ready ? 'Service ready' : 'Service unavailable';
  } catch {
    elements.serviceState.dataset.state = 'unavailable';
    elements.serviceStateLabel.textContent = 'Service unavailable';
  }
};

const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const numberValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const objectValue = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const shortenId = (value: string): string =>
  value.length > 15 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

const responseFacts = (body: unknown): EvidenceFact[] => {
  const value = objectValue(body);
  if (!value) return [];

  const facts: EvidenceFact[] = [];
  const amount = stringValue(value.amount);
  const currency = stringValue(value.currency);
  const status = stringValue(value.status);
  const id = stringValue(value.id);
  const code = stringValue(value.code);
  const detail = stringValue(value.detail) ?? stringValue(value.message);
  const checkedAccounts = numberValue(value.checkedAccounts);
  const discrepancies = Array.isArray(value.discrepancies) ? value.discrepancies.length : null;
  const entries = Array.isArray(value.entries) ? value.entries.length : null;

  if (amount) facts.push({ label: 'Amount', value: `${amount} ${currency ?? ''}`.trim() });
  if (status) facts.push({ label: 'Transfer state', value: status, tone: 'success' });
  if (id) facts.push({ label: 'Transfer ID', value: shortenId(id) });
  if (code) facts.push({ label: 'Error code', value: code, tone: 'error' });
  if (detail) facts.push({ label: 'Reason', value: detail, tone: 'error' });
  if (checkedAccounts !== null) {
    facts.push({ label: 'Accounts checked', value: String(checkedAccounts) });
  }
  if (discrepancies !== null) {
    facts.push({
      label: 'Discrepancies',
      value: String(discrepancies),
      tone: discrepancies === 0 ? 'success' : 'error',
    });
  }
  if (entries !== null) facts.push({ label: 'Ledger entries', value: String(entries) });

  return facts;
};

const appendFacts = (event: HTMLElement, facts: EvidenceFact[]): void => {
  if (facts.length === 0) return;
  const list = document.createElement('dl');
  list.className = 'response-facts';
  for (const fact of facts) {
    const item = document.createElement('div');
    if (fact.label === 'Reason' || fact.label === 'Error code') item.classList.add('wide');
    const label = document.createElement('dt');
    label.textContent = fact.label;
    const value = document.createElement('dd');
    value.textContent = fact.value;
    if (fact.tone) value.classList.add(fact.tone);
    item.append(label, value);
    list.append(item);
  }
  event.append(list);
};

const appendRawResponse = (event: HTMLElement, raw: unknown): void => {
  if (raw === null || raw === undefined) return;
  const disclosure = document.createElement('details');
  disclosure.className = 'response-raw';
  const summary = document.createElement('summary');
  summary.textContent = 'View raw JSON';
  const body = document.createElement('pre');
  body.className = 'event-body';
  body.textContent = JSON.stringify(raw, null, 2);
  disclosure.append(summary, body);
  event.append(disclosure);
};

const addEvidence = (
  title: string,
  result: ApiResult<unknown>,
  options: EvidenceOptions = {},
): void => {
  elements.evidence.querySelector('.evidence-empty')?.remove();
  const event = document.createElement('article');
  event.className = `evidence-event${result.ok ? '' : ' is-error'}`;

  const meta = document.createElement('div');
  meta.className = 'event-meta';
  const request = document.createElement('span');
  request.className = 'event-request';
  const method = document.createElement('b');
  method.textContent = options.method ?? 'LOCAL';
  const path = document.createElement('span');
  path.textContent = options.path ?? 'Browser check';
  request.append(method, path);
  const time = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
  meta.append(request, time);

  const headingRow = document.createElement('div');
  headingRow.className = 'event-heading';
  const heading = document.createElement('h3');
  heading.className = 'event-title';
  heading.textContent = title;
  const status = document.createElement('span');
  status.className = `event-status${result.ok ? '' : ' error'}`;
  status.textContent = options.statusText ?? `HTTP ${result.status}`;
  headingRow.append(heading, status);

  event.append(meta, headingRow);

  if (result.replayed) {
    const replay = document.createElement('p');
    replay.className = 'response-note';
    replay.textContent = 'The API returned the original transfer. No money moved twice.';
    event.append(replay);
  }

  if (options.summary) {
    const summary = document.createElement('p');
    summary.className = 'response-summary';
    summary.textContent = options.summary;
    event.append(summary);
  }

  appendFacts(event, options.facts ?? responseFacts(result.body));
  appendRawResponse(event, options.raw === undefined ? result.body : options.raw);
  elements.evidence.prepend(event);
};

const renderAccounts = (): void => {
  elements.accounts.replaceChildren();
  state.accounts.forEach((account, index) => {
    const item = document.createElement('article');
    item.className = 'account-item';
    item.style.animationDelay = `${index * 80}ms`;

    const name = document.createElement('div');
    name.className = 'account-name';
    const label = document.createElement('span');
    label.textContent = account.name;
    const suffix = document.createElement('span');
    suffix.textContent = `••${account.id.slice(-4)}`;
    name.append(label, suffix);

    const balance = document.createElement('div');
    balance.className = 'account-balance';
    const currency = document.createElement('small');
    currency.textContent = account.currency;
    balance.append(document.createTextNode(account.balance), currency);
    item.append(name, balance);
    elements.accounts.append(item);
  });
};

const refreshAccounts = async (record = true): Promise<ApiResult<SandboxAccount[]>> => {
  const session = state.session;
  if (!session) throw new Error('sandbox_session_missing');
  const results = await Promise.all(
    session.accounts.map((account) => request<SandboxAccount>(`/v1/accounts/${account.id}`)),
  );
  const failed = results.find((result) => !result.ok);
  if (failed) {
    if (record) {
      addEvidence('Refresh balances', failed, {
        method: 'GET',
        path: '/v1/accounts/:id',
      });
    }
    return { ...failed, body: [] };
  }
  state.accounts = results.map((result) => result.body);
  renderAccounts();
  const result: ApiResult<SandboxAccount[]> = { status: 200, ok: true, body: state.accounts };
  if (record) {
    addEvidence('Balances refreshed', result, {
      method: 'GET',
      path: '/v1/accounts/:id',
      facts: state.accounts.map((account) => ({
        label: account.name,
        value: `${account.balance} ${account.currency}`,
      })),
    });
  }
  return result;
};

const accountPair = (): [SandboxAccount, SandboxAccount] => {
  const session = state.session;
  const source = session?.accounts[0];
  const destination = session?.accounts[1];
  if (!source || !destination) throw new Error('sandbox_account_pair_missing');
  return [source, destination];
};

const transfer = (key: string, body: TransferRequest): Promise<ApiResult<TransferResponse>> =>
  request<TransferResponse>('/v1/transfers', {
    method: 'POST',
    headers: { 'idempotency-key': key },
    body: JSON.stringify(body),
  });

const transferBody = (amount: string): TransferRequest => {
  const [source, destination] = accountPair();
  return {
    sourceAccountId: source.id,
    destinationAccountId: destination.id,
    amount,
    currency: 'USD',
  };
};

const runSuccess = async (): Promise<void> => {
  const key = randomKey('sandbox-success');
  const body = transferBody('125.75');
  const result = await transfer(key, body);
  if (result.ok) state.lastTransfer = { key, body };
  addEvidence('Successful transfer', result, {
    method: 'POST',
    path: '/v1/transfers',
  });
  await refreshAccounts(false);
};

const runReplay = async (): Promise<void> => {
  const previous = state.lastTransfer;
  if (!previous) {
    addEvidence(
      'Safe replay',
      { status: 0, ok: false, body: null },
      {
        summary: 'Run a successful transfer first.',
        statusText: 'Not sent',
        raw: null,
      },
    );
    return;
  }
  const result = await transfer(previous.key, previous.body);
  addEvidence('Safe replay', result, {
    method: 'POST',
    path: '/v1/transfers',
  });
  await refreshAccounts(false);
};

const runConflict = async (): Promise<void> => {
  const previous = state.lastTransfer;
  if (!previous) {
    addEvidence(
      'Idempotency conflict',
      { status: 0, ok: false, body: null },
      {
        summary: 'Run a successful transfer first.',
        statusText: 'Not sent',
        raw: null,
      },
    );
    return;
  }
  const result = await transfer(previous.key, { ...previous.body, amount: '125.76' });
  addEvidence('Idempotency conflict', result, {
    method: 'POST',
    path: '/v1/transfers',
  });
};

const runInsufficient = async (): Promise<void> => {
  const result = await transfer(randomKey('sandbox-insufficient'), transferBody('999999.00'));
  addEvidence('Insufficient funds', result, {
    method: 'POST',
    path: '/v1/transfers',
  });
  await refreshAccounts(false);
};

const toMinor = (amount: string): bigint => {
  const [whole = '0', fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

const formatMinor = (minor: bigint): string =>
  `${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`;

const runRace = async (): Promise<void> => {
  await refreshAccounts(false);
  const source = state.accounts[0];
  if (!source) throw new Error('sandbox_source_account_missing');
  const amount = formatMinor((toMinor(source.balance) * 6n) / 10n);
  const body = transferBody(amount);
  const results = await Promise.all([
    transfer(randomKey('sandbox-race-a'), body),
    transfer(randomKey('sandbox-race-b'), body),
  ]);
  const successful = results.filter((result) => result.ok);
  const rejected = results.filter((result) => !result.ok);
  const protectedBalance =
    successful.length === 1 &&
    rejected.length === 1 &&
    rejected[0]?.status === 422 &&
    rejected[0].body.code === 'insufficient_funds';
  addEvidence(
    'Concurrent spending',
    { status: protectedBalance ? 200 : 500, ok: protectedBalance, body: results },
    {
      method: 'POST',
      path: '/v1/transfers × 2',
      summary: protectedBalance
        ? 'Both requests competed for one balance. One committed and one was rejected.'
        : 'The responses did not prove serialized spending.',
      statusText: protectedBalance ? 'Protected' : 'Inconclusive',
      facts: [
        { label: 'Amount per request', value: `${amount} USD` },
        ...results.map((result, index) => ({
          label: `Request ${index + 1}`,
          value: `HTTP ${result.status} · ${result.body.code ?? result.body.status ?? 'unknown'}`,
          tone: result.ok ? ('success' as const) : ('error' as const),
        })),
      ],
    },
  );
  await refreshAccounts(false);
};

const runEntries = async (): Promise<void> => {
  const [source] = accountPair();
  const result = await request<AccountEntries>(`/v1/accounts/${source.id}/entries?limit=50`);
  addEvidence('Immutable entries', result, {
    method: 'GET',
    path: '/v1/accounts/:id/entries',
  });
};

const runReconciliation = async (): Promise<void> => {
  const result = await request<Reconciliation>('/v1/operations/reconciliation');
  addEvidence('Reconciliation', result, {
    method: 'GET',
    path: '/v1/operations/reconciliation',
  });
};

const startSession = async (): Promise<void> => {
  setBusy(true);
  try {
    const result = await request<SandboxSession>('/v1/sandbox/sessions', { method: 'POST' });
    if (!result.ok) {
      addEvidence('Create test account', result, {
        method: 'POST',
        path: '/v1/sandbox/sessions',
      });
      return;
    }
    state.session = result.body;
    state.accounts = result.body.accounts;
    state.lastTransfer = null;
    elements.status.textContent = `Active • ${result.body.tenantId.slice(0, 8)}`;
    elements.start.textContent = 'Account ready';
    renderAccounts();
    startCountdown();
    addEvidence(
      'Test account created',
      { status: result.status, ok: true, body: null },
      {
        method: 'POST',
        path: '/v1/sandbox/sessions',
        summary: 'The browser received a temporary token and kept it in memory only.',
        facts: [
          { label: 'Tenant', value: shortenId(result.body.tenantId) },
          { label: 'Accounts', value: '2 synthetic USD accounts' },
          { label: 'Session', value: '15 minutes' },
        ],
        raw: {
          tenantId: result.body.tenantId,
          expiresAt: result.body.expiresAt,
          accounts: result.body.accounts,
        },
      },
    );
  } catch (error) {
    addEvidence(
      'Connection error',
      { status: 0, ok: false, body: null },
      {
        summary: error instanceof Error ? error.message : 'The service could not be reached.',
        statusText: 'Offline',
        raw: null,
      },
    );
  } finally {
    setBusy(false);
  }
};

const actions: Record<string, () => Promise<unknown>> = {
  refresh: () => refreshAccounts(),
  success: runSuccess,
  replay: runReplay,
  conflict: runConflict,
  insufficient: runInsufficient,
  race: runRace,
  entries: runEntries,
  reconcile: runReconciliation,
};

const runAction = async (name: string): Promise<void> => {
  if (!state.session || state.busy) return;
  const action = actions[name];
  if (!action) return;
  setBusy(true);
  try {
    await action();
  } catch (error) {
    addEvidence(
      'Connection error',
      { status: 0, ok: false, body: null },
      {
        summary: error instanceof Error ? error.message : 'The action could not be completed.',
        statusText: 'Offline',
        raw: null,
      },
    );
  } finally {
    setBusy(false);
  }
};

elements.start.addEventListener('click', () => void startSession());
elements.reset.addEventListener('click', () => void startSession());
for (const button of elements.actions) {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action) void runAction(action);
  });
}

setBusy(false);
void checkReadiness();

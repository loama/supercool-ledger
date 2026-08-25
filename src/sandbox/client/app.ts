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
  elements.status.textContent = 'Sesión expirada';
  elements.time.textContent = '00:00';
  elements.start.textContent = 'Crear nueva sesión';
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

const addEvidence = (title: string, result: ApiResult<unknown>, detail?: string): void => {
  elements.evidence.querySelector('.evidence-empty')?.remove();
  const event = document.createElement('article');
  event.className = 'evidence-event';

  const meta = document.createElement('div');
  meta.className = 'event-meta';
  const time = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString('es-MX', { hour12: false });
  const status = document.createElement('span');
  status.className = `event-status${result.ok ? '' : ' error'}`;
  status.textContent = `HTTP ${result.status}`;
  meta.append(time, status);

  const heading = document.createElement('h3');
  heading.className = 'event-title';
  heading.textContent = title;

  const body = document.createElement('pre');
  body.className = 'event-body';
  body.textContent = detail ?? JSON.stringify(result.body, null, 2);

  event.append(meta, heading, body);
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
    if (record) addEvidence('Actualizar saldos', failed);
    return { ...failed, body: [] };
  }
  state.accounts = results.map((result) => result.body);
  renderAccounts();
  const result: ApiResult<SandboxAccount[]> = { status: 200, ok: true, body: state.accounts };
  if (record) {
    addEvidence(
      'Saldos actualizados',
      result,
      state.accounts
        .map((account) => `${account.name}: ${account.balance} ${account.currency}`)
        .join('\n'),
    );
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
  addEvidence('Transferencia válida', result);
  await refreshAccounts(false);
};

const runReplay = async (): Promise<void> => {
  const previous = state.lastTransfer;
  if (!previous) {
    addEvidence(
      'Repetición segura',
      { status: 0, ok: false, body: null },
      'Ejecuta primero una transferencia válida.',
    );
    return;
  }
  const result = await transfer(previous.key, previous.body);
  addEvidence(
    'Repetición segura',
    result,
    `${result.replayed ? 'Idempotent-Replayed: true' : 'Sin cabecera de repetición'}\n${JSON.stringify(result.body, null, 2)}`,
  );
  await refreshAccounts(false);
};

const runConflict = async (): Promise<void> => {
  const previous = state.lastTransfer;
  if (!previous) {
    addEvidence(
      'Conflicto de idempotencia',
      { status: 0, ok: false, body: null },
      'Ejecuta primero una transferencia válida.',
    );
    return;
  }
  const result = await transfer(previous.key, { ...previous.body, amount: '125.76' });
  addEvidence('Conflicto de idempotencia', result);
};

const runInsufficient = async (): Promise<void> => {
  const result = await transfer(randomKey('sandbox-insufficient'), transferBody('999999.00'));
  addEvidence('Fondos insuficientes', result);
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
  const bothSucceeded = results.every((result) => result.ok);
  const detail = results
    .map(
      (result, index) =>
        `Solicitud ${index + 1}: HTTP ${result.status} ${result.body.code ?? result.body.status ?? ''}`,
    )
    .join('\n');
  addEvidence(
    'Competencia por el saldo',
    { status: bothSucceeded ? 500 : 200, ok: !bothSucceeded, body: results },
    `${detail}\nImporte por solicitud: ${amount} USD`,
  );
  await refreshAccounts(false);
};

const runEntries = async (): Promise<void> => {
  const [source] = accountPair();
  const result = await request<AccountEntries>(`/v1/accounts/${source.id}/entries?limit=50`);
  addEvidence('Movimientos inmutables', result);
};

const runReconciliation = async (): Promise<void> => {
  const result = await request<Reconciliation>('/v1/operations/reconciliation');
  addEvidence('Conciliación', result);
};

const startSession = async (): Promise<void> => {
  setBusy(true);
  try {
    const result = await request<SandboxSession>('/v1/sandbox/sessions', { method: 'POST' });
    if (!result.ok) {
      addEvidence('Crear sesión', result);
      return;
    }
    state.session = result.body;
    state.accounts = result.body.accounts;
    state.lastTransfer = null;
    elements.status.textContent = `Activa • ${result.body.tenantId.slice(0, 8)}`;
    elements.start.textContent = 'Sandbox activo';
    renderAccounts();
    startCountdown();
    addEvidence(
      'Sesión creada',
      { status: result.status, ok: true, body: null },
      `Tenant aislado: ${result.body.tenantId.slice(0, 8)}\n2 cuentas sintéticas\nJWT guardado solo en memoria`,
    );
  } catch (error) {
    addEvidence(
      'Error de conexión',
      { status: 0, ok: false, body: null },
      error instanceof Error ? error.message : 'No fue posible conectar con el servicio.',
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
      'Error de conexión',
      { status: 0, ok: false, body: null },
      error instanceof Error ? error.message : 'No fue posible completar la acción.',
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

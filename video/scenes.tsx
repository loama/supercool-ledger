import type { CSSProperties, ReactNode } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import demo from './assets/demo-run.json';
import {
  BrowserFrame,
  Connector,
  Eyebrow,
  FlowNode,
  Reveal,
  SceneShell,
  StatusMarker,
  Title,
  activeStep,
} from './components.tsx';
import { sceneRanges } from './timing.ts';
import { theme } from './theme.ts';

type SceneId = (typeof sceneRanges)[number]['id'];

const sceneDuration = (id: SceneId): number => {
  const range = sceneRanges.find((candidate) => candidate.id === id);
  if (!range) throw new Error('scene_range_missing');
  return range.to - range.from;
};

const labelStyle: CSSProperties = {
  color: theme.gray,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const FlowRow = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
);

export const FinancialPromiseScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 3, sceneDuration('financial-promise'));
  const pulse = interpolate(frame % 44, [0, 22, 44], [0.96, 1.02, 0.96]);
  const promises = [
    ['No desaparece', 'La suma de los postings cierra en cero.'],
    ['No se duplica', 'La misma clave devuelve la misma transferencia.'],
    ['No se gasta dos veces', 'Los bloqueos leen el saldo antes de escribir.'],
  ];
  return (
    <SceneShell index={1} tone="dark">
      <div
        style={{
          height: 'calc(100% - 50px)',
          display: 'grid',
          gridTemplateColumns: '1.3fr 0.7fr',
          alignItems: 'center',
          gap: 94,
        }}
      >
        <div>
          <Reveal>
            <Eyebrow tone="dark">La promesa financiera</Eyebrow>
            <Title size={98} maxWidth={1050}>
              El dinero se mueve una vez. La verdad contable queda.
            </Title>
          </Reveal>
          <Reveal delay={18}>
            <div
              style={{
                maxWidth: 840,
                marginTop: 36,
                color: theme.gray,
                fontSize: 27,
                lineHeight: 1.42,
              }}
            >
              PostgreSQL confirma la transferencia, los asientos y los saldos en una sola
              transacción.
            </div>
          </Reveal>
        </div>
        <Reveal delay={10}>
          <div
            style={{
              position: 'relative',
              padding: '42px 38px 36px',
              border: `1px solid ${theme.lineDark}`,
              borderRadius: 20,
              background: 'rgba(25, 25, 25, 0.84)',
            }}
          >
            <div
              style={{
                width: 170,
                height: 170,
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 38px',
                border: `1px solid ${theme.yellow}`,
                borderRadius: '50%',
                color: theme.ink,
                background: theme.yellow,
                fontSize: 58,
                fontWeight: 500,
                letterSpacing: '-0.05em',
                transform: `scale(${pulse})`,
              }}
            >
              Σ 0
            </div>
            {promises.map(([title, detail], index) => (
              <div
                key={title}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '22px 1fr',
                  gap: 15,
                  padding: '18px 0',
                  borderTop: `1px solid ${theme.lineDark}`,
                  opacity: index === active ? 1 : index < active ? 0.74 : 0.42,
                }}
              >
                <StatusMarker active={index === active} complete={index < active} tone="dark" />
                <div>
                  <div style={{ fontSize: 23, fontWeight: 520 }}>{title}</div>
                  <div style={{ marginTop: 7, color: theme.gray, fontSize: 15, lineHeight: 1.35 }}>
                    {detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

export const LedgerInvariantsScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 4, sceneDuration('ledger-invariants'));
  const invariants = [
    ['Partida doble', 'Cada journal_transaction cierra en cero.'],
    ['Historial inmutable', 'Un posting confirmado no cambia ni desaparece.'],
    ['Una moneda', 'Las cuentas y los asientos comparten moneda.'],
    ['Saldo consistente', 'El saldo cambia junto con los postings.'],
  ];
  return (
    <SceneShell index={2} tone="light">
      <div style={{ marginTop: 58 }}>
        <Reveal>
          <Eyebrow tone="light">Invariantes financieras</Eyebrow>
          <Title size={75}>La base de datos rechaza un ledger que no cierra.</Title>
        </Reveal>
        <div style={{ marginTop: 58, borderTop: `1px solid ${theme.lineLight}` }}>
          {invariants.map(([title, detail], index) => {
            const current = index === active;
            return (
              <Reveal key={title} delay={8 + index * 7}>
                <div
                  style={{
                    minHeight: 108,
                    display: 'grid',
                    gridTemplateColumns: '94px 0.72fr 1.28fr 150px',
                    alignItems: 'center',
                    gap: 24,
                    padding: '0 24px',
                    borderBottom: `1px solid ${theme.lineLight}`,
                    background: current ? theme.yellow : 'transparent',
                  }}
                >
                  <span
                    style={{
                      color: current ? theme.ink : theme.grayDark,
                      fontSize: 18,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 30, fontWeight: 520 }}>{title}</span>
                  <span style={{ color: theme.grayDark, fontSize: 22 }}>{detail}</span>
                  <StatusMarker
                    active={current}
                    complete={index < active}
                    label={current ? 'activa' : index < active ? 'verificada' : 'pendiente'}
                    tone="light"
                  />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};

export const RepositoryMapScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 5, sceneDuration('repository-map'));
  const groups: ReadonlyArray<readonly [string, string]> = [
    ['Entrada API', 'src/server.ts\nsrc/app.ts'],
    ['Dominio', 'transfers/service.ts\naccounts/repository.ts'],
    ['Reglas SQL', 'migrations/\ntriggers y constraints'],
    ['Evidencia', 'scripts/demo-capture.ts\ndemo-run.json'],
    ['Operación', 'docs/operations.md\ninfra/aws/'],
  ];
  return (
    <SceneShell index={3} tone="light">
      <div style={{ marginTop: 54 }}>
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
            <div>
              <Eyebrow tone="light">Mapa del repositorio</Eyebrow>
              <Title size={68} maxWidth={1160}>
                Cada afirmación conduce a un archivo concreto.
              </Title>
            </div>
            <div style={{ ...labelStyle, color: theme.grayDark, paddingBottom: 8 }}>
              Lectura de izquierda a derecha&nbsp; →
            </div>
          </div>
        </Reveal>
        <Reveal delay={14}>
          <FlowRow>
            <div style={{ marginTop: 78, display: 'flex', alignItems: 'center' }}>
              {groups.map(([title, detail], index) => (
                <div key={title} style={{ display: 'flex', alignItems: 'center' }}>
                  <FlowNode
                    active={index === active}
                    detail={detail.split('\n').map((line) => (
                      <div key={line} style={{ fontFamily: theme.mono, fontSize: 14 }}>
                        {line}
                      </div>
                    ))}
                    index={String(index + 1).padStart(2, '0')}
                    tone="light"
                    width={282}
                    height={250}
                  >
                    {title}
                  </FlowNode>
                  {index < groups.length - 1 ? (
                    <Connector active={index === active} length={44} tone="light" />
                  ) : null}
                </div>
              ))}
            </div>
          </FlowRow>
        </Reveal>
        <Reveal delay={30}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 46,
              padding: '19px 24px',
              border: `1px solid ${theme.lineLight}`,
              borderRadius: 8,
              color: theme.grayDark,
              background: 'rgba(255, 255, 255, 0.62)',
              fontSize: 18,
            }}
          >
            <span>API → dominio → reglas de base de datos</span>
            <span>ejecución → captura → guía operativa</span>
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

export const RequestLifecycleScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 6, sceneDuration('request-lifecycle'));
  const nodes = [
    ['Fastify', 'src/app.ts'],
    ['Autenticación', 'tenant y permisos'],
    ['TypeBox', 'cuerpo validado'],
    ['Servicio', 'reglas financieras'],
    ['PostgreSQL', 'una transacción'],
    ['Señales', 'logs, métricas y trazas'],
  ];
  return (
    <SceneShell index={4} tone="dark">
      <div style={{ marginTop: 54 }}>
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
            <div>
              <Eyebrow tone="dark">Ciclo de la solicitud</Eyebrow>
              <Title size={66} maxWidth={1160}>
                La solicitud avanza con una sola dirección de autoridad.
              </Title>
            </div>
            <div style={{ ...labelStyle, paddingBottom: 8 }}>Solicitud → resultado</div>
          </div>
        </Reveal>
        <Reveal delay={12}>
          <div
            style={{
              marginTop: 92,
              padding: '38px 30px',
              border: `1px solid ${theme.lineDark}`,
              borderRadius: 16,
              background: 'rgba(17, 17, 17, 0.62)',
            }}
          >
            <FlowRow>
              {nodes.map(([title, detail], index) => (
                <div key={title} style={{ display: 'flex', alignItems: 'center' }}>
                  <FlowNode
                    active={index === active}
                    detail={detail}
                    index={String(index + 1).padStart(2, '0')}
                    tone="dark"
                    width={234}
                    height={220}
                  >
                    {title}
                  </FlowNode>
                  {index < nodes.length - 1 ? (
                    <Connector active={index === active} length={42} tone="dark" />
                  ) : null}
                </div>
              ))}
            </FlowRow>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 34,
                paddingTop: 24,
                borderTop: `1px solid ${theme.lineDark}`,
                color: theme.gray,
                fontSize: 17,
              }}
            >
              <span>Las reglas se validan antes de abrir la transacción.</span>
              <span style={{ color: active === 4 ? theme.yellow : theme.gray }}>
                PostgreSQL decide el resultado financiero.
              </span>
              <span>Las señales observan. No deciden.</span>
            </div>
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

export const AtomicTransferScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 5, sceneDuration('atomic-transfer'));
  const steps = [
    ['Idempotencia', 'reclamar clave'],
    ['Bloqueos', 'UUID ascendente'],
    ['Validaciones', 'tenant, moneda, estado y fondos'],
    ['Escritura', 'transferencia, postings y saldos'],
    ['Confirmación', 'auditoría y respuesta'],
  ];
  return (
    <SceneShell index={5} tone="dark">
      <div style={{ marginTop: 50 }}>
        <Reveal>
          <Eyebrow tone="dark">Transferencia atómica</Eyebrow>
          <Title size={66}>El orden fijo impide que dos solicitudes gasten el mismo saldo.</Title>
        </Reveal>
        <Reveal delay={12}>
          <div
            style={{
              marginTop: 70,
              padding: '26px 28px 30px',
              border: `1px solid ${theme.lineDark}`,
              borderRadius: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 28,
                color: theme.gray,
                fontFamily: theme.mono,
                fontSize: 14,
              }}
            >
              <span>BEGIN</span>
              <span style={{ color: theme.yellow }}>una transacción PostgreSQL</span>
              <span>COMMIT</span>
            </div>
            <FlowRow>
              {steps.map(([title, detail], index) => (
                <div key={title} style={{ display: 'flex', alignItems: 'center' }}>
                  <FlowNode
                    active={index === active}
                    detail={detail}
                    index={String(index + 1).padStart(2, '0')}
                    tone="dark"
                    width={275}
                    height={200}
                  >
                    {title}
                  </FlowNode>
                  {index < steps.length - 1 ? (
                    <Connector active={index === active} length={44} tone="dark" />
                  ) : null}
                </div>
              ))}
            </FlowRow>
          </div>
        </Reveal>
        <Reveal delay={30}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr auto 1.4fr',
              alignItems: 'center',
              gap: 18,
              marginTop: 32,
            }}
          >
            <div
              style={{
                padding: '18px 22px',
                border: `1px solid ${active === 1 ? theme.yellow : theme.lineDark}`,
                color: active === 1 ? theme.yellow : theme.gray,
                fontFamily: theme.mono,
                fontSize: 15,
              }}
            >
              cuenta con UUID menor
            </div>
            <Connector active={active === 1} length={42} tone="dark" />
            <div
              style={{
                padding: '18px 22px',
                border: `1px solid ${active === 1 ? theme.yellow : theme.lineDark}`,
                color: active === 1 ? theme.yellow : theme.gray,
                fontFamily: theme.mono,
                fontSize: 15,
              }}
            >
              cuenta con UUID mayor
            </div>
            <Connector active={active >= 3} length={42} tone="dark" />
            <div
              style={{
                padding: '18px 22px',
                color: active >= 3 ? theme.ink : theme.gray,
                background: active >= 3 ? theme.yellow : theme.inkRaised,
                fontSize: 17,
              }}
            >
              25000 débito + 25000 crédito = 0
            </div>
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

export const DataModelScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 7, sceneDuration('data-model'));
  const primary = [
    ['tenants', 'raíz de aislamiento'],
    ['accounts', 'saldo y moneda'],
    ['transfers', 'operación financiera'],
    ['journal_transactions', 'unidad contable'],
    ['postings', 'historial inmutable'],
  ];
  return (
    <SceneShell index={6} tone="light">
      <div style={{ marginTop: 47 }}>
        <Reveal>
          <Eyebrow tone="light">Modelo de datos</Eyebrow>
          <Title size={64}>
            El tenant, la transferencia y el journal comparten la misma frontera.
          </Title>
        </Reveal>
        <Reveal delay={12}>
          <div style={{ marginTop: 65 }}>
            <FlowRow>
              {primary.map(([title, detail], index) => (
                <div key={title} style={{ display: 'flex', alignItems: 'center' }}>
                  <FlowNode
                    active={index === active}
                    detail={detail}
                    index={String(index + 1).padStart(2, '0')}
                    tone="light"
                    width={280}
                    height={184}
                  >
                    <span style={{ fontFamily: theme.mono, fontSize: 22 }}>{title}</span>
                  </FlowNode>
                  {index < primary.length - 1 ? (
                    <Connector active={index === active} length={44} tone="light" />
                  ) : null}
                </div>
              ))}
            </FlowRow>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '280px 44px 280px 44px 280px 44px 280px 44px 280px',
                margin: '0 auto',
                width: 'max-content',
              }}
            >
              <div style={{ gridColumn: 1, justifySelf: 'center' }}>
                <Connector active={active === 5} direction="vertical" length={42} tone="light" />
              </div>
              <div style={{ gridColumn: 5, justifySelf: 'center' }}>
                <Connector active={active === 6} direction="vertical" length={42} tone="light" />
              </div>
              <FlowNode
                active={active === 5}
                detail="tenant sintético y vencimiento"
                index="06"
                tone="light"
                width={280}
                height={144}
                style={{ gridColumn: 1 }}
              >
                <span style={{ fontFamily: theme.mono, fontSize: 21 }}>sandbox_sessions</span>
              </FlowNode>
              <FlowNode
                active={active === 6}
                detail="resultado sin datos financieros"
                index="07"
                tone="light"
                width={280}
                height={144}
                style={{ gridColumn: 5 }}
              >
                <span style={{ fontFamily: theme.mono, fontSize: 21 }}>audit_events</span>
              </FlowNode>
            </div>
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

export const SandboxWorkflowScene = () => {
  const frame = useCurrentFrame();
  const steps = [
    ['Sesión', 'POST /sessions'],
    ['Éxito', 'HTTP 201'],
    ['Replay', 'mismo id'],
    ['Conflicto', 'misma clave'],
    ['Fondos', 'HTTP 422'],
    ['Carrera', 'dos solicitudes'],
    ['Asientos', 'GET /entries'],
    ['Conciliación', 'cero diferencias'],
  ];
  const active = activeStep(frame, steps.length, sceneDuration('reviewer-sandbox'));
  return (
    <SceneShell index={7} tone="light">
      <div style={{ marginTop: 42 }}>
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
            <div>
              <Eyebrow tone="light">Flujo del sandbox</Eyebrow>
              <Title size={62}>Ocho pasos reproducen las garantías financieras.</Title>
            </div>
            <StatusMarker active label="sesión aislada" tone="light" />
          </div>
        </Reveal>
        <Reveal delay={12}>
          <div style={{ marginTop: 45 }}>
            <BrowserFrame address="supercool-ledger.onrender.com/sandbox">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '270px 1fr',
                  minHeight: 450,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 30,
                    color: theme.white,
                    background: theme.ink,
                  }}
                >
                  <div>
                    <div style={labelStyle}>Reviewer sandbox</div>
                    <div style={{ marginTop: 18, fontSize: 34, lineHeight: 1.02 }}>
                      Prueba el ledger en vivo.
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: 24,
                      color: theme.ink,
                      background: theme.yellow,
                      fontSize: 16,
                      fontWeight: 580,
                    }}
                  >
                    Cuenta temporal activa
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', padding: '38px 34px' }}>
                  {steps.map(([title, detail], index) => (
                    <div key={title} style={{ display: 'flex', alignItems: 'center' }}>
                      <FlowNode
                        active={index === active}
                        detail={detail}
                        index={String(index + 1).padStart(2, '0')}
                        tone="light"
                        width={151}
                        height={220}
                        style={{ padding: 17 }}
                      >
                        <span style={{ fontSize: 21 }}>{title}</span>
                      </FlowNode>
                      {index < steps.length - 1 ? (
                        <Connector active={index === active} length={24} tone="light" />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </BrowserFrame>
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

export const CapturedEvidenceScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 5, sceneDuration('captured-evidence'));
  const rows = [
    ['Transferencia creada', `HTTP ${demo.success.status}`, '250.00 USD'],
    [
      'Repetición segura',
      `HTTP ${demo.replay.status}`,
      demo.replay.sameTransfer ? 'mismo id' : 'otro id',
    ],
    ['Fondos insuficientes', `HTTP ${demo.overspend.status}`, demo.overspend.code],
    [
      'Postings balanceados',
      demo.postings.reduce((sum, posting) => sum + BigInt(posting.amountMinor), 0n).toString(),
      'suma en minor units',
    ],
    [
      'Conciliación',
      `${demo.reconciliation.discrepancies.length} diferencias`,
      `${demo.reconciliation.checkedAccounts} cuentas`,
    ],
  ];
  return (
    <SceneShell index={8} tone="dark">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.72fr 1.28fr',
          gap: 84,
          marginTop: 54,
        }}
      >
        <div>
          <Reveal>
            <Eyebrow tone="dark">Evidencia operativa</Eyebrow>
            <Title size={70}>La captura conserva el resultado de PostgreSQL.</Title>
          </Reveal>
          <Reveal delay={18}>
            <div
              style={{
                marginTop: 52,
                paddingTop: 28,
                borderTop: `1px solid ${theme.lineDark}`,
              }}
            >
              <div style={{ color: theme.gray, fontFamily: theme.mono, fontSize: 15 }}>
                video/assets/demo-run.json
              </div>
              <div
                style={{ marginTop: 18, fontSize: 54, lineHeight: 1.1, letterSpacing: '-0.05em' }}
              >
                <div>250.00 débito</div>
                <div>+ 250.00 crédito</div>
              </div>
              <div style={{ marginTop: 8, color: theme.yellow, fontSize: 40 }}>= 0</div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={10}>
          <div
            style={{
              borderTop: `1px solid ${theme.lineDark}`,
              background: 'rgba(25, 25, 25, 0.76)',
            }}
          >
            {rows.map(([label, value, detail], index) => (
              <div
                key={label}
                style={{
                  minHeight: 118,
                  display: 'grid',
                  gridTemplateColumns: '42px 1.1fr 0.7fr 0.7fr',
                  alignItems: 'center',
                  gap: 20,
                  padding: '0 28px',
                  borderBottom: `1px solid ${theme.lineDark}`,
                  color: index === active ? theme.ink : theme.white,
                  background: index === active ? theme.yellow : 'transparent',
                }}
              >
                <StatusMarker active={index === active} complete={index < active} tone="dark" />
                <span style={{ fontSize: 24 }}>{label}</span>
                <span style={{ fontFamily: theme.mono, fontSize: 19, fontWeight: 600 }}>
                  {value}
                </span>
                <span
                  style={{
                    color: index === active ? theme.grayDark : theme.gray,
                    fontSize: 16,
                    textAlign: 'right',
                  }}
                >
                  {detail}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

const AwsService = ({
  active,
  detail,
  title,
}: {
  active: boolean;
  detail: string;
  title: string;
}) => (
  <div
    style={{
      minHeight: 84,
      padding: '14px 16px',
      border: `1px solid ${active ? theme.yellow : theme.lineDark}`,
      borderRadius: 4,
      color: active ? theme.ink : theme.white,
      background: active ? theme.yellow : theme.inkRaised,
    }}
  >
    <div style={{ fontSize: 19, fontWeight: 540 }}>{title}</div>
    <div
      style={{
        marginTop: 6,
        color: active ? theme.grayDark : theme.gray,
        fontSize: 13,
        lineHeight: 1.25,
      }}
    >
      {detail}
    </div>
  </div>
);

export const AwsTopologyScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 5, sceneDuration('aws-topology'));
  return (
    <SceneShell index={9} tone="dark">
      <div style={{ marginTop: 34 }}>
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
            <div>
              <Eyebrow tone="dark">Topología AWS</Eyebrow>
              <Title size={55} maxWidth={1170}>
                Dos zonas, un escritor y una migración antes del servicio.
              </Title>
            </div>
            <StatusMarker active label="sin réplica de lectura" tone="dark" />
          </div>
        </Reveal>
        <Reveal delay={10}>
          <div
            style={{ display: 'grid', gridTemplateColumns: '174px 1fr', gap: 28, marginTop: 35 }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <FlowNode active={active === 0} detail="HTTPS" tone="dark" width={142} height={132}>
                Internet
              </FlowNode>
              <Connector active={active === 0} length={32} tone="dark" />
            </div>
            <div
              style={{
                padding: '20px 22px 22px',
                border: `1px solid ${theme.lineDark}`,
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  color: theme.gray,
                  fontSize: 13,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                }}
              >
                <span>VPC</span>
                <span>HTTPS → ALB → ECS → RDS writer</span>
                <span>eu central 1</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px 236px 40px 290px 40px 340px 1fr',
                  gridTemplateRows: '120px 120px',
                  gap: '12px 10px',
                  alignItems: 'center',
                }}
              >
                <div style={{ ...labelStyle, gridColumn: 1, gridRow: 1 }}>Zona A</div>
                <div style={{ ...labelStyle, gridColumn: 1, gridRow: 2 }}>Zona B</div>
                <div style={{ gridColumn: 2, gridRow: '1 / 3' }}>
                  <AwsService
                    active={active === 1}
                    detail="subredes públicas de ambas zonas"
                    title="Application Load Balancer"
                  />
                  <div style={{ marginTop: 10 }}>
                    <AwsService
                      active={active === 1}
                      detail="uno compartido en la zona A"
                      title="NAT gateway"
                    />
                  </div>
                </div>
                <div style={{ gridColumn: 3, gridRow: '1 / 3', justifySelf: 'center' }}>
                  <Connector active={active === 1} length={40} tone="dark" />
                </div>
                <div style={{ gridColumn: 4, gridRow: 1 }}>
                  <AwsService
                    active={active === 2}
                    detail="tarea privada, sin IP pública"
                    title="ECS Fargate · tarea 1"
                  />
                </div>
                <div style={{ gridColumn: 4, gridRow: 2 }}>
                  <AwsService
                    active={active === 2}
                    detail="tarea privada, escala de 2 a 6"
                    title="ECS Fargate · tarea 2"
                  />
                </div>
                <div style={{ gridColumn: 5, gridRow: '1 / 3', justifySelf: 'center' }}>
                  <Connector active={active === 2} length={40} tone="dark" />
                </div>
                <div style={{ gridColumn: 6, gridRow: '1 / 3' }}>
                  <AwsService
                    active={active === 3}
                    detail="PostgreSQL 17 Multi AZ, writer y standby"
                    title="RDS writer endpoint"
                  />
                  <div style={{ marginTop: 10 }}>
                    <AwsService
                      active={active === 4}
                      detail="misma imagen y DATABASE_URL"
                      title="Tarea de migración"
                    />
                  </div>
                </div>
                <div
                  style={{
                    gridColumn: 7,
                    gridRow: '1 / 3',
                    display: 'grid',
                    gap: 8,
                    paddingLeft: 8,
                  }}
                >
                  {['ECR inmutable', 'Secrets Manager', 'CloudWatch'].map((label) => (
                    <div
                      key={label}
                      style={{
                        padding: '13px 15px',
                        border: `1px solid ${theme.lineDark}`,
                        color: theme.gray,
                        fontSize: 15,
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={26}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1.2fr auto 1fr',
              alignItems: 'center',
              gap: 16,
              marginTop: 26,
            }}
          >
            {[
              ['bootstrap_mode = true', 'el servicio no existe todavía'],
              ['bun run db:migrate', 'la tarea debe terminar con código cero'],
              ['bootstrap_mode = false', 'Terraform crea el servicio'],
            ].map(([title, detail], index) => (
              <div key={title} style={{ display: 'contents' }}>
                <div
                  style={{
                    padding: '15px 20px',
                    border: `1px solid ${active === index + 2 ? theme.yellow : theme.lineDark}`,
                    color: active === index + 2 ? theme.ink : theme.white,
                    background: active === index + 2 ? theme.yellow : 'transparent',
                  }}
                >
                  <div style={{ fontFamily: theme.mono, fontSize: 16 }}>{title}</div>
                  <div
                    style={{
                      marginTop: 4,
                      color: active === index + 2 ? theme.grayDark : theme.gray,
                      fontSize: 13,
                    }}
                  >
                    {detail}
                  </div>
                </div>
                {index < 2 ? (
                  <Connector active={active === index + 2} length={40} tone="dark" />
                ) : null}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

export const ReviewPathScene = () => {
  const frame = useCurrentFrame();
  const active = activeStep(frame, 4, sceneDuration('review-path'));
  const steps = [
    ['Sandbox publicado', '/sandbox', 'ejecuta los siete escenarios'],
    ['Referencia API', '/docs', 'lee el contrato OpenAPI'],
    ['Pruebas', 'bun test', 'repite la evidencia local'],
    ['Código fuente', 'README.md', 'abre cada archivo citado'],
  ];
  return (
    <SceneShell index={10} tone="light">
      <div style={{ marginTop: 56 }}>
        <Reveal>
          <Eyebrow tone="light">Ruta de revisión</Eyebrow>
          <Title size={74}>Empieza con el servicio. Termina en la línea que lo demuestra.</Title>
        </Reveal>
        <Reveal delay={12}>
          <div style={{ marginTop: 78 }}>
            <FlowRow>
              {steps.map(([title, command, detail], index) => (
                <div key={title} style={{ display: 'flex', alignItems: 'center' }}>
                  <FlowNode
                    active={index === active}
                    detail={
                      <div>
                        <div style={{ fontFamily: theme.mono, fontSize: 17 }}>{command}</div>
                        <div style={{ marginTop: 12 }}>{detail}</div>
                      </div>
                    }
                    index={String(index + 1).padStart(2, '0')}
                    tone="light"
                    width={350}
                    height={250}
                  >
                    {title}
                  </FlowNode>
                  {index < steps.length - 1 ? (
                    <Connector active={index === active} length={55} tone="light" />
                  ) : null}
                </div>
              ))}
            </FlowRow>
          </div>
        </Reveal>
        <Reveal delay={30}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 52,
              padding: '22px 28px',
              borderRadius: 32,
              color: theme.ink,
              background: theme.yellow,
              fontSize: 19,
            }}
          >
            <span style={{ fontWeight: 600 }}>supercool-ledger.onrender.com/sandbox</span>
            <span>Datos sintéticos · sesión temporal · PostgreSQL real</span>
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
};

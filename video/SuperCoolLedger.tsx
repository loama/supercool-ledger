import { Audio } from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import demo from './assets/demo-run.json';
import { captionCues } from './captions.ts';

const colors = {
  ink: '#171915',
  muted: '#656960',
  canvas: '#f3f1e9',
  paper: '#fbfaf5',
  green: '#237a4d',
  paleGreen: '#d8e9df',
  yellow: '#e9c95b',
  line: '#d7d5cc',
  red: '#9d4138',
};

const base: React.CSSProperties = {
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  color: colors.ink,
};

const Shell = ({ children, index }: { children: React.ReactNode; index: string }) => (
  <AbsoluteFill
    style={{
      ...base,
      backgroundColor: colors.canvas,
      backgroundImage:
        'linear-gradient(rgba(23,25,21,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,25,21,0.035) 1px, transparent 1px)',
      backgroundSize: '64px 64px',
      padding: '72px 86px',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 760, letterSpacing: '0.08em' }}>SUPERCOOL</div>
      <div style={{ fontSize: 16, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>
        {index} / 07
      </div>
    </div>
    {children}
  </AbsoluteFill>
);

const Enter = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ fps, frame: frame - delay, config: { damping: 18, mass: 0.7 } });
  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [32, 0])}px)`,
      }}
    >
      {children}
    </div>
  );
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      color: colors.green,
      fontSize: 18,
      fontWeight: 760,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      marginBottom: 22,
    }}
  >
    {children}
  </div>
);

const Title = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 78,
      lineHeight: 1.03,
      letterSpacing: '-0.055em',
      wordSpacing: '0.08em',
      fontWeight: 680,
    }}
  >
    {children}
  </div>
);

const Intro = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [0, 180, 359], [0.78, 1, 0.78], {
    easing: Easing.inOut((value) => Easing.ease(value)),
  });
  return (
    <Shell index="01">
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 100 }}>
        <div style={{ flex: 1 }}>
          <Enter>
            <Eyebrow>Account balance service</Eyebrow>
            <Title>
              Correctness,
              <br />
              made visible.
            </Title>
          </Enter>
          <Enter delay={18}>
            <div style={{ fontSize: 28, lineHeight: 1.45, color: colors.muted, marginTop: 34 }}>
              A narrow financial service with executable proof for every critical claim.
            </div>
          </Enter>
        </div>
        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: '50%',
            border: `2px solid ${colors.green}`,
            display: 'grid',
            placeItems: 'center',
            transform: `scale(${pulse})`,
          }}
        >
          <div
            style={{
              width: 278,
              height: 278,
              borderRadius: '50%',
              background: colors.paleGreen,
              display: 'grid',
              placeItems: 'center',
              fontSize: 86,
              fontWeight: 650,
              letterSpacing: '-0.06em',
            }}
          >
            Σ 0
          </div>
        </div>
      </div>
    </Shell>
  );
};

const Invariants = () => {
  const items = [
    ['01', 'Every journal balances to zero.'],
    ['02', 'Posted history cannot change or disappear.'],
    ['03', 'A retry cannot create a second transfer.'],
    ['04', 'Concurrent requests cannot overspend.'],
  ];
  return (
    <Shell index="02">
      <div style={{ marginTop: 92 }}>
        <Enter>
          <Eyebrow>Financial invariants</Eyebrow>
          <Title>The contract starts below the API.</Title>
        </Enter>
        <div style={{ marginTop: 68, borderTop: `1px solid ${colors.line}` }}>
          {items.map(([number, text], index) => (
            <Enter key={number} delay={12 + index * 8}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 72px',
                  alignItems: 'center',
                  minHeight: 104,
                  borderBottom: `1px solid ${colors.line}`,
                  fontSize: 31,
                }}
              >
                <span style={{ color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {number}
                </span>
                <span>{text}</span>
                <span style={{ color: colors.green, fontSize: 35 }}>✓</span>
              </div>
            </Enter>
          ))}
        </div>
      </div>
    </Shell>
  );
};

const Architecture = () => {
  const nodes = ['Authentication', 'Accounts', 'Transfers', 'Reconciliation'];
  return (
    <Shell index="03">
      <div style={{ marginTop: 78 }}>
        <Enter>
          <Eyebrow>One commit boundary</Eyebrow>
          <Title>Small service. Strong authority.</Title>
        </Enter>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 32, marginTop: 74 }}>
          <Enter delay={12}>
            <div
              style={{
                width: 250,
                height: 358,
                border: `1px solid ${colors.line}`,
                background: colors.paper,
                padding: 34,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 18, color: colors.muted }}>REQUEST</span>
              <span style={{ fontSize: 42, fontWeight: 650 }}>Fastify API</span>
              <span style={{ fontSize: 21, color: colors.muted }}>Schemas and tenant scopes</span>
            </div>
          </Enter>
          <div
            style={{
              flex: 1,
              border: `2px solid ${colors.green}`,
              background: colors.paleGreen,
              padding: 32,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            {nodes.map((node, index) => (
              <Enter key={node} delay={20 + index * 6}>
                <div
                  style={{
                    height: 138,
                    background: colors.paper,
                    border: `1px solid ${colors.line}`,
                    padding: 24,
                    fontSize: 26,
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  {node}
                </div>
              </Enter>
            ))}
          </div>
          <Enter delay={42}>
            <div
              style={{
                width: 390,
                height: 358,
                background: colors.ink,
                color: colors.paper,
                padding: 34,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: '#adb2a7', fontSize: 18 }}>AUTHORITY</span>
              <span style={{ fontSize: 48, fontWeight: 650 }}>PostgreSQL</span>
              <div style={{ fontSize: 21, lineHeight: 1.5, color: '#c9ccc3' }}>
                Locks
                <br />
                Constraints
                <br />
                Immutable postings
              </div>
            </div>
          </Enter>
        </div>
      </div>
    </Shell>
  );
};

const TransferPath = () => {
  const frame = useCurrentFrame();
  const steps = ['Claim key', 'Lock accounts', 'Validate funds', 'Write postings', 'Commit'];
  const active = Math.min(steps.length - 1, Math.floor(frame / 78));
  return (
    <Shell index="04">
      <div style={{ marginTop: 74 }}>
        <Enter>
          <Eyebrow>Atomic transfer</Eyebrow>
          <Title>Order is a correctness feature.</Title>
        </Enter>
        <div
          style={{ position: 'relative', marginTop: 104, display: 'flex', alignItems: 'center' }}
        >
          <div
            style={{
              position: 'absolute',
              left: 70,
              right: 70,
              top: 38,
              height: 2,
              background: colors.line,
            }}
          />
          {steps.map((step, index) => {
            const enabled = index <= active;
            return (
              <div key={step} style={{ flex: 1, zIndex: 1, textAlign: 'center' }}>
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: '50%',
                    margin: '0 auto',
                    display: 'grid',
                    placeItems: 'center',
                    color: enabled ? colors.paper : colors.muted,
                    background: enabled ? colors.green : colors.paper,
                    border: `2px solid ${enabled ? colors.green : colors.line}`,
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ marginTop: 22, fontSize: 24, fontWeight: enabled ? 650 : 450 }}>
                  {step}
                </div>
              </div>
            );
          })}
        </div>
        <Enter delay={28}>
          <div
            style={{
              marginTop: 92,
              padding: '30px 40px',
              display: 'flex',
              justifyContent: 'space-between',
              background: colors.ink,
              color: colors.paper,
              fontSize: 23,
            }}
          >
            <span>Sorted lock order reduces deadlocks</span>
            <span style={{ color: '#96d0ad' }}>Posting sum = 0</span>
            <span>Response stored with the commit</span>
          </div>
        </Enter>
      </div>
    </Shell>
  );
};

const EvidenceRow = ({
  label,
  value,
  tone = 'green',
  delay,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'red';
  delay: number;
}) => (
  <Enter delay={delay}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 70px',
        alignItems: 'center',
        height: 102,
        borderBottom: `1px solid ${colors.line}`,
        fontSize: 28,
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650 }}>{value}</span>
      <span style={{ color: tone === 'green' ? colors.green : colors.red }}>●</span>
    </div>
  </Enter>
);

const Demo = () => (
  <Shell index="05">
    <div style={{ marginTop: 68, display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 82 }}>
      <div>
        <Enter>
          <Eyebrow>Captured from PostgreSQL</Eyebrow>
          <Title>One run. Five proofs.</Title>
        </Enter>
        <Enter delay={22}>
          <div style={{ marginTop: 58, fontSize: 24, lineHeight: 1.55, color: colors.muted }}>
            Transfer {demo.success.body.id.slice(0, 8)}
            <br />
            {demo.success.body.amount} {demo.success.body.currency}
          </div>
          <div
            style={{
              marginTop: 38,
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              fontSize: 42,
              fontWeight: 650,
            }}
          >
            <span style={{ color: colors.red }}>250.00 debit</span>
            <span style={{ color: colors.muted }}>+</span>
            <span style={{ color: colors.green }}>250.00 credit</span>
            <span>= 0</span>
          </div>
        </Enter>
      </div>
      <div style={{ borderTop: `1px solid ${colors.line}` }}>
        <EvidenceRow label="Transfer created" value={`HTTP ${demo.success.status}`} delay={8} />
        <EvidenceRow label="Same key replayed" value={`HTTP ${demo.replay.status}`} delay={18} />
        <EvidenceRow
          label="Same transfer returned"
          value={demo.replay.sameTransfer ? 'TRUE' : 'FALSE'}
          delay={28}
        />
        <EvidenceRow
          label="Overspend rejected"
          value={`HTTP ${demo.overspend.status}`}
          tone="red"
          delay={38}
        />
        <EvidenceRow
          label="Reconciliation"
          value={`${demo.reconciliation.discrepancies.length} discrepancies`}
          delay={48}
        />
      </div>
    </div>
  </Shell>
);

const Observability = () => {
  const frame = useCurrentFrame();
  const cursor = interpolate(frame, [0, 480], [2, 94], { extrapolateRight: 'clamp' });
  return (
    <Shell index="06">
      <div style={{ marginTop: 72 }}>
        <Enter>
          <Eyebrow>Operational evidence</Eyebrow>
          <Title>Every failure leaves a signal.</Title>
        </Enter>
        <div style={{ marginTop: 84, position: 'relative' }}>
          <div style={{ height: 2, background: colors.line, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: `${cursor}%`,
                top: -8,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: colors.yellow,
                transform: 'translateX(-50%)',
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 42 }}>
            {[
              ['LOGS', 'Bounded JSON'],
              ['METRICS', 'Prometheus'],
              ['TRACES', 'OpenTelemetry'],
              ['ERRORS', 'Sentry'],
            ].map(([label, value], index) => (
              <Enter key={label} delay={index * 10}>
                <div
                  style={{ minHeight: 184, borderLeft: `1px solid ${colors.line}`, padding: 28 }}
                >
                  <div style={{ color: colors.green, fontWeight: 760, letterSpacing: '0.12em' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 31, marginTop: 52 }}>{value}</div>
                </div>
              </Enter>
            ))}
          </div>
          <Enter delay={36}>
            <div
              style={{
                marginTop: 56,
                background: colors.paleGreen,
                padding: '28px 34px',
                fontSize: 24,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>No amounts in trace attributes</span>
              <span>No unbounded metric labels</span>
              <span>No payloads in logs</span>
            </div>
          </Enter>
        </div>
      </div>
    </Shell>
  );
};

const Closing = () => (
  <Shell index="07">
    <div
      style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Enter>
        <Eyebrow>Review the evidence</Eyebrow>
        <Title>
          Proof
          <br />
          over breadth.
        </Title>
        <div style={{ marginTop: 42, fontSize: 26, color: colors.muted }}>
          github.com/loama/supercool-ledger
        </div>
      </Enter>
      <Enter delay={18}>
        <div
          style={{
            width: 570,
            background: colors.ink,
            color: colors.paper,
            padding: 52,
          }}
        >
          <div style={{ fontSize: 20, color: '#aeb3a8', letterSpacing: '0.12em' }}>DELIVERED</div>
          <div style={{ marginTop: 42, fontSize: 31, lineHeight: 1.8 }}>
            Immutable ledger
            <br />
            Concurrency tests included
            <br />
            OpenAPI and Docker
            <br />
            Render infrastructure
            <br />
            Complete engineering record
          </div>
        </div>
      </Enter>
    </div>
  </Shell>
);

const Captions = () => {
  const frame = useCurrentFrame();
  const cue = captionCues.find(({ from, to }) => frame >= from && frame < to);
  if (!cue) return null;
  const opacity = interpolate(frame, [cue.from, cue.from + 8, cue.to - 8, cue.to], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        ...base,
        position: 'absolute',
        left: '50%',
        bottom: 28,
        transform: 'translateX(-50%)',
        width: 1380,
        padding: '16px 28px',
        background: 'rgba(23, 25, 21, 0.94)',
        color: colors.paper,
        fontSize: 24,
        lineHeight: 1.35,
        textAlign: 'center',
        opacity,
      }}
    >
      {cue.text}
    </div>
  );
};

export const SuperCoolLedger = () => (
  <AbsoluteFill style={{ background: colors.canvas }}>
    <Audio src={staticFile('narration.mp3')} volume={0.95} />
    <Sequence from={0} durationInFrames={360} premountFor={30}>
      <Intro />
    </Sequence>
    <Sequence from={360} durationInFrames={570} premountFor={30}>
      <Invariants />
    </Sequence>
    <Sequence from={930} durationInFrames={540} premountFor={30}>
      <Architecture />
    </Sequence>
    <Sequence from={1470} durationInFrames={660} premountFor={30}>
      <TransferPath />
    </Sequence>
    <Sequence from={2130} durationInFrames={690} premountFor={30}>
      <Demo />
    </Sequence>
    <Sequence from={2820} durationInFrames={570} premountFor={30}>
      <Observability />
    </Sequence>
    <Sequence from={3390} durationInFrames={660} premountFor={30}>
      <Closing />
    </Sequence>
    <Captions />
  </AbsoluteFill>
);

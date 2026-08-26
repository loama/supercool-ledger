import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { captionCues } from './captions.ts';
import { darkAtmosphere, grainSize, lightAtmosphere, theme } from './theme.ts';
import { VIDEO_PAGE_COUNT } from './timing.ts';

type Tone = 'dark' | 'light';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export const activeStep = (frame: number, total: number, duration: number): number =>
  Math.min(total - 1, Math.floor(frame / (duration / total)));

export const Reveal = ({
  children,
  delay = 0,
  distance = 24,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const value = spring({
    fps,
    frame: frame - delay,
    config: { damping: 24, mass: 0.72, stiffness: 120 },
  });
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(value, [0, 1], [0, 1], clamp),
        transform: `translateY(${interpolate(value, [0, 1], [distance, 0], clamp)}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const AssessmentWordmark = ({ tone }: { tone: Tone }) => {
  const foreground = tone === 'dark' ? theme.white : theme.ink;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <div
        style={{
          width: 34,
          height: 34,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          alignItems: 'end',
          gap: 3,
          padding: '8px 7px',
          background: foreground,
        }}
      >
        {[9, 14, 19].map((height) => (
          <span key={height} style={{ height, background: theme.yellow }} />
        ))}
      </div>
      <div
        style={{
          color: foreground,
          fontSize: 20,
          fontWeight: 650,
          letterSpacing: '0.08em',
        }}
      >
        SUPERCOOL LEDGER
      </div>
    </div>
  );
};

export const SceneShell = ({
  children,
  index,
  tone,
}: {
  children: ReactNode;
  index: number;
  tone: Tone;
}) => {
  const foreground = tone === 'dark' ? theme.white : theme.ink;
  const line = tone === 'dark' ? theme.lineDark : theme.lineLight;
  return (
    <AbsoluteFill
      style={{
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '54px 74px 150px',
        color: foreground,
        backgroundColor: tone === 'dark' ? theme.ink : theme.softWhite,
        backgroundImage: tone === 'dark' ? darkAtmosphere : lightAtmosphere,
        backgroundSize: grainSize,
        backgroundRepeat: 'no-repeat, repeat',
        fontFamily: theme.font,
      }}
    >
      <header
        style={{
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${line}`,
          paddingBottom: 18,
        }}
      >
        <AssessmentWordmark tone={tone} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            color: tone === 'dark' ? theme.gray : theme.grayDark,
            fontSize: 17,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ color: foreground }}>{String(index).padStart(2, '0')}</span>
          <span style={{ width: 44, height: 1, background: line }} />
          <span>{VIDEO_PAGE_COUNT}</span>
        </div>
      </header>
      {children}
    </AbsoluteFill>
  );
};

export const Eyebrow = ({ children, tone }: { children: ReactNode; tone: Tone }) => (
  <div
    style={{
      marginBottom: 16,
      color: tone === 'dark' ? theme.yellow : theme.grayDark,
      fontSize: 17,
      fontWeight: 620,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

export const Title = ({
  children,
  size = 76,
  maxWidth = 1320,
}: {
  children: ReactNode;
  size?: number;
  maxWidth?: number;
}) => (
  <div
    style={{
      maxWidth,
      fontSize: size,
      fontWeight: 430,
      lineHeight: 0.98,
      letterSpacing: '-0.055em',
      textWrap: 'balance',
    }}
  >
    {children}
  </div>
);

export const StatusMarker = ({
  active,
  complete = false,
  label,
  tone,
}: {
  active: boolean;
  complete?: boolean;
  label?: string;
  tone: Tone;
}) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame % 36, [0, 18, 36], [0.76, 1, 0.76]);
  const color = active || complete ? theme.yellow : tone === 'dark' ? theme.gray : theme.grayDark;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: color,
          opacity: active ? pulse : complete ? 1 : 0.45,
          transform: active ? `scale(${pulse})` : undefined,
        }}
      />
      {label ? <span style={{ fontSize: 15 }}>{label}</span> : null}
    </div>
  );
};

export const FlowNode = ({
  active,
  children,
  detail,
  index,
  tone,
  width = 230,
  height = 184,
  style,
}: {
  active: boolean;
  children: ReactNode;
  detail?: ReactNode;
  index?: string;
  tone: Tone;
  width?: number | string;
  height?: number;
  style?: CSSProperties;
}) => {
  const surface = active ? theme.yellow : tone === 'dark' ? theme.inkRaised : theme.white;
  const foreground = active ? theme.ink : tone === 'dark' ? theme.white : theme.ink;
  const secondary = active ? theme.grayDark : tone === 'dark' ? theme.gray : theme.grayDark;
  const line = active ? theme.yellow : tone === 'dark' ? theme.lineDark : theme.lineLight;
  return (
    <div
      style={{
        boxSizing: 'border-box',
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 24,
        border: `1px solid ${line}`,
        borderRadius: 4,
        color: foreground,
        background: surface,
        transform: active ? 'translateY(-7px)' : 'translateY(0)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        {index ? (
          <span style={{ color: secondary, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {index}
          </span>
        ) : (
          <span />
        )}
        <StatusMarker active={active} tone={tone} />
      </div>
      <div>
        <div style={{ fontSize: 27, fontWeight: 520, lineHeight: 1.05 }}>{children}</div>
        {detail ? (
          <div style={{ marginTop: 12, color: secondary, fontSize: 16, lineHeight: 1.35 }}>
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const Connector = ({
  active,
  direction = 'horizontal',
  length = 52,
  tone,
}: {
  active: boolean;
  direction?: 'horizontal' | 'vertical';
  length?: number;
  tone: Tone;
}) => {
  const frame = useCurrentFrame();
  const color = active ? theme.yellow : tone === 'dark' ? theme.lineDark : theme.lineLight;
  const travel = interpolate(frame % 30, [0, 30], [0, Math.max(0, length - 11)]);
  if (direction === 'vertical') {
    return (
      <div style={{ position: 'relative', width: 18, height: length, flex: '0 0 auto' }}>
        <span
          style={{ position: 'absolute', left: 8, top: 0, bottom: 7, width: 1, background: color }}
        />
        <span
          style={{
            position: 'absolute',
            left: 5,
            bottom: 2,
            width: 7,
            height: 7,
            borderRight: `1px solid ${color}`,
            borderBottom: `1px solid ${color}`,
            transform: 'rotate(45deg)',
          }}
        />
        {active ? (
          <span
            style={{
              position: 'absolute',
              left: 5,
              top: travel,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: theme.yellow,
            }}
          />
        ) : null}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: length, height: 18, flex: '0 0 auto' }}>
      <span
        style={{ position: 'absolute', left: 0, right: 7, top: 8, height: 1, background: color }}
      />
      <span
        style={{
          position: 'absolute',
          right: 2,
          top: 5,
          width: 7,
          height: 7,
          borderRight: `1px solid ${color}`,
          borderTop: `1px solid ${color}`,
          transform: 'rotate(45deg)',
        }}
      />
      {active ? (
        <span
          style={{
            position: 'absolute',
            left: travel,
            top: 5,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: theme.yellow,
          }}
        />
      ) : null}
    </div>
  );
};

export const BrowserFrame = ({
  children,
  address,
  tone = 'light',
}: {
  children: ReactNode;
  address: string;
  tone?: Tone;
}) => (
  <div
    style={{
      overflow: 'hidden',
      border: `1px solid ${tone === 'dark' ? theme.lineDark : theme.lineLight}`,
      borderRadius: 18,
      background: tone === 'dark' ? theme.inkRaised : theme.white,
    }}
  >
    <div
      style={{
        height: 54,
        display: 'grid',
        gridTemplateColumns: '110px 1fr 110px',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: `1px solid ${tone === 'dark' ? theme.lineDark : theme.lineLight}`,
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: dot === 0 ? theme.yellow : theme.gray,
              opacity: dot === 0 ? 1 : 0.42,
            }}
          />
        ))}
      </div>
      <div
        style={{
          justifySelf: 'center',
          color: tone === 'dark' ? theme.gray : theme.grayDark,
          fontFamily: theme.mono,
          fontSize: 13,
        }}
      >
        {address}
      </div>
    </div>
    {children}
  </div>
);

export const CaptionBar = () => {
  const frame = useCurrentFrame();
  const cue = captionCues.find(({ from, to }) => frame >= from && frame < to);
  if (!cue) return null;
  const opacity = interpolate(frame, [cue.from, cue.from + 7, cue.to - 7, cue.to], [0, 1, 1, 0], {
    ...clamp,
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 54,
        width: 1430,
        boxSizing: 'border-box',
        padding: '15px 28px 16px',
        border: `1px solid ${theme.lineDark}`,
        borderRadius: 10,
        color: theme.white,
        background: 'rgba(17, 17, 17, 0.96)',
        fontFamily: theme.font,
        fontSize: 25,
        fontWeight: 440,
        lineHeight: 1.3,
        textAlign: 'center',
        transform: 'translateX(-50%)',
        opacity,
      }}
    >
      {cue.text}
    </div>
  );
};

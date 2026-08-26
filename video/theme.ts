export const theme = {
  ink: '#111111',
  inkRaised: '#191919',
  white: '#ffffff',
  softWhite: '#f7f7f2',
  yellow: '#fff98e',
  gray: '#a3a3a3',
  grayDark: '#666662',
  lineDark: 'rgba(255, 255, 255, 0.16)',
  lineLight: 'rgba(17, 17, 17, 0.16)',
  font: "'DM Sans Variable', 'DM Sans', sans-serif",
  mono: "'SFMono-Regular', 'Roboto Mono', ui-monospace, monospace",
} as const;

export const darkAtmosphere = [
  'radial-gradient(circle at 78% 8%, rgba(255, 249, 142, 0.16), transparent 30%)',
  'radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.045) 0 1px, transparent 1px)',
].join(', ');

export const lightAtmosphere = [
  'radial-gradient(circle at 82% 4%, rgba(255, 249, 142, 0.52), transparent 27%)',
  'radial-gradient(circle at 20% 18%, rgba(17, 17, 17, 0.035) 0 1px, transparent 1px)',
].join(', ');

export const grainSize = '100% 100%, 11px 11px';

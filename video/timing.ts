export const VIDEO_PLAYBACK_RATE = 1.5;
export const VIDEO_DURATION_IN_FRAMES = 2970;

export const sceneRanges = [
  { id: 'financial-promise', from: 0, to: 264 },
  { id: 'ledger-invariants', from: 264, to: 650 },
  { id: 'repository-map', from: 650, to: 870 },
  { id: 'request-lifecycle', from: 870, to: 1080 },
  { id: 'atomic-transfer', from: 1080, to: 1480 },
  { id: 'data-model', from: 1480, to: 1700 },
  { id: 'reviewer-sandbox', from: 1700, to: 1950 },
  { id: 'captured-evidence', from: 1950, to: 2205 },
  { id: 'aws-topology', from: 2205, to: 2730 },
  { id: 'review-path', from: 2730, to: VIDEO_DURATION_IN_FRAMES },
] as const;

export const captionFrameRanges = [
  [0, 125],
  [125, 264],
  [264, 393],
  [393, 554],
  [554, 682],
  [682, 792],
  [792, 891],
  [891, 990],
  [990, 1078],
  [1078, 1203],
  [1203, 1327],
  [1327, 1445],
  [1445, 1562],
  [1562, 1650],
  [1650, 1753],
  [1753, 1863],
  [1863, 1936],
  [1936, 2068],
  [2068, 2160],
  [2160, 2266],
  [2266, 2351],
  [2351, 2486],
  [2486, 2721],
  [2721, VIDEO_DURATION_IN_FRAMES],
] as const;

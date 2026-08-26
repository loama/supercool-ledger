export const NARRATION_TEMPO_RATE = 1.5;
export const VIDEO_PLAYBACK_RATE = 1;
export const VIDEO_FPS = 30;
export const VIDEO_DURATION_IN_FRAMES = 2970;
export const VIDEO_PAGE_COUNT = 11;
export const NARRATION_DURATION_MILLISECONDS = 145_214.688;

export const narrationCueStartMilliseconds = [
  70, 5150, 13680, 17440, 26400, 33050, 39500, 44430, 47160, 53460, 58170, 62400, 67750, 75380,
  78960, 85300, 91600, 95510, 100820, 103100, 107730, 111130, 121700, 138040,
] as const;

export const sourceMillisecondsToVideoFrame = (milliseconds: number): number =>
  Math.round((milliseconds / 1000 / NARRATION_TEMPO_RATE) * VIDEO_FPS);

export const NARRATION_END_FRAME = sourceMillisecondsToVideoFrame(NARRATION_DURATION_MILLISECONDS);

const sceneFrameBoundaries = [0, 274, 661, 790, 1069, 1508, 1579, 1910, 2062, 2434, 2970] as const;

export const sceneRanges = [
  { id: 'financial-promise', from: sceneFrameBoundaries[0], to: sceneFrameBoundaries[1] },
  { id: 'ledger-invariants', from: sceneFrameBoundaries[1], to: sceneFrameBoundaries[2] },
  { id: 'repository-map', from: sceneFrameBoundaries[2], to: sceneFrameBoundaries[3] },
  { id: 'request-lifecycle', from: sceneFrameBoundaries[3], to: sceneFrameBoundaries[4] },
  { id: 'atomic-transfer', from: sceneFrameBoundaries[4], to: sceneFrameBoundaries[5] },
  { id: 'data-model', from: sceneFrameBoundaries[5], to: sceneFrameBoundaries[6] },
  { id: 'reviewer-sandbox', from: sceneFrameBoundaries[6], to: sceneFrameBoundaries[7] },
  { id: 'captured-evidence', from: sceneFrameBoundaries[7], to: sceneFrameBoundaries[8] },
  { id: 'observability', from: sceneFrameBoundaries[8], to: sceneFrameBoundaries[9] },
  { id: 'aws-review-path', from: sceneFrameBoundaries[9], to: VIDEO_DURATION_IN_FRAMES },
] as const;

export const visualPageRanges = [
  ...sceneRanges.slice(0, 9),
  { id: 'aws-topology', from: sceneFrameBoundaries[9], to: sceneFrameBoundaries[9] + 324 },
  { id: 'review-path', from: sceneFrameBoundaries[9] + 324, to: VIDEO_DURATION_IN_FRAMES },
] as const;

export const captionFrameRanges = narrationCueStartMilliseconds.map((milliseconds, index) => [
  sourceMillisecondsToVideoFrame(milliseconds),
  index + 1 < narrationCueStartMilliseconds.length
    ? sourceMillisecondsToVideoFrame(narrationCueStartMilliseconds[index + 1] ?? 0)
    : NARRATION_END_FRAME,
]) as ReadonlyArray<readonly [number, number]>;

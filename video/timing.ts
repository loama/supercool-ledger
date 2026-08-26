export const VIDEO_PLAYBACK_RATE = 1.5;
export const VIDEO_FPS = 30;
export const VIDEO_DURATION_IN_FRAMES = 2970;

export const narrationCueStartMilliseconds = [
  0, 5150, 13540, 17300, 26400, 32800, 39500, 44200, 46900, 53460, 57900, 62200, 67600, 75100,
  78960, 85300, 91600, 95510, 100700, 102900, 107730, 110900, 121700, 137900,
] as const;

export const sourceMillisecondsToVideoFrame = (milliseconds: number): number =>
  Math.round((milliseconds / 1000 / VIDEO_PLAYBACK_RATE) * VIDEO_FPS);

const sceneFrameBoundaries = [0, 271, 656, 790, 1069, 1502, 1579, 1910, 2058, 2434, 2970] as const;

export const sceneRanges = [
  { id: 'financial-promise', from: sceneFrameBoundaries[0], to: sceneFrameBoundaries[1] },
  { id: 'ledger-invariants', from: sceneFrameBoundaries[1], to: sceneFrameBoundaries[2] },
  { id: 'repository-map', from: sceneFrameBoundaries[2], to: sceneFrameBoundaries[3] },
  { id: 'request-lifecycle', from: sceneFrameBoundaries[3], to: sceneFrameBoundaries[4] },
  { id: 'atomic-transfer', from: sceneFrameBoundaries[4], to: sceneFrameBoundaries[5] },
  { id: 'data-model', from: sceneFrameBoundaries[5], to: sceneFrameBoundaries[6] },
  { id: 'reviewer-sandbox', from: sceneFrameBoundaries[6], to: sceneFrameBoundaries[7] },
  { id: 'captured-evidence', from: sceneFrameBoundaries[7], to: sceneFrameBoundaries[8] },
  { id: 'aws-topology', from: sceneFrameBoundaries[8], to: sceneFrameBoundaries[9] },
  { id: 'review-path', from: sceneFrameBoundaries[9], to: VIDEO_DURATION_IN_FRAMES },
] as const;

export const captionFrameRanges = narrationCueStartMilliseconds.map((milliseconds, index) => [
  sourceMillisecondsToVideoFrame(milliseconds),
  index + 1 < narrationCueStartMilliseconds.length
    ? sourceMillisecondsToVideoFrame(narrationCueStartMilliseconds[index + 1] ?? 0)
    : VIDEO_DURATION_IN_FRAMES,
]) as ReadonlyArray<readonly [number, number]>;

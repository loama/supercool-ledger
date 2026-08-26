import { narrationSegments } from './narration.ts';

export interface CaptionCue {
  from: number;
  to: number;
  text: string;
}

const cueFrames = [
  [0, 187],
  [187, 396],
  [396, 589],
  [589, 831],
  [831, 1023],
  [1023, 1188],
  [1188, 1337],
  [1337, 1485],
  [1485, 1617],
  [1617, 1804],
  [1804, 1991],
  [1991, 2167],
  [2167, 2343],
  [2343, 2475],
  [2475, 2629],
  [2629, 2794],
  [2794, 2904],
  [2904, 3102],
  [3102, 3240],
  [3240, 3399],
  [3399, 3526],
  [3526, 3729],
  [3729, 4081],
  [4081, 4455],
] as const;

export const captionCues: CaptionCue[] = cueFrames.map(([from, to], index) => {
  const text = narrationSegments[index];
  if (!text) throw new Error('caption_segment_missing');
  return { from, to, text };
});

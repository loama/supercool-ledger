import { narrationSegments } from './narration.ts';

export interface CaptionCue {
  from: number;
  to: number;
  text: string;
}

const cueFrames = [
  [0, 170],
  [170, 360],
  [360, 535],
  [535, 755],
  [755, 930],
  [930, 1080],
  [1080, 1215],
  [1215, 1350],
  [1350, 1470],
  [1470, 1640],
  [1640, 1810],
  [1810, 1970],
  [1970, 2130],
  [2130, 2250],
  [2250, 2390],
  [2390, 2540],
  [2540, 2640],
  [2640, 2820],
  [2820, 2945],
  [2945, 3090],
  [3090, 3205],
  [3205, 3390],
  [3390, 3710],
  [3710, 4050],
] as const;

export const captionCues: CaptionCue[] = cueFrames.map(([from, to], index) => {
  const text = narrationSegments[index];
  if (!text) throw new Error('caption_segment_missing');
  return { from, to, text };
});

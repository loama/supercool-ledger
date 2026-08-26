import { narrationSegments } from './narration.ts';
import { captionFrameRanges } from './timing.ts';

export interface CaptionCue {
  from: number;
  to: number;
  text: string;
}

export const captionCues: CaptionCue[] = captionFrameRanges.map(([from, to], index) => {
  const text = narrationSegments[index];
  if (!text) throw new Error('caption_segment_missing');
  return { from, to, text };
});

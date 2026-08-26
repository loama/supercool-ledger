import { Composition } from 'remotion';
import { SuperCoolLedger } from './SuperCoolLedger.tsx';
import { VIDEO_DURATION_IN_FRAMES } from './timing.ts';

export const VideoRoot = () => (
  <Composition
    id="SuperCoolLedger"
    component={SuperCoolLedger}
    durationInFrames={VIDEO_DURATION_IN_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
);

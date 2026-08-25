import { Composition } from 'remotion';
import { SuperCoolLedger } from './SuperCoolLedger.tsx';

export const VideoRoot = () => (
  <Composition
    id="SuperCoolLedger"
    component={SuperCoolLedger}
    durationInFrames={4050}
    fps={30}
    width={1920}
    height={1080}
  />
);

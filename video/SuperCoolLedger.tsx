import { Audio } from '@remotion/media';
import type { ComponentType } from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { CaptionBar } from './components.tsx';
import {
  AtomicTransferScene,
  AwsReviewPathScene,
  CapturedEvidenceScene,
  DataModelScene,
  FinancialPromiseScene,
  LedgerInvariantsScene,
  ObservabilityScene,
  RepositoryMapScene,
  RequestLifecycleScene,
  SandboxWorkflowScene,
} from './scenes.tsx';
import { VIDEO_PLAYBACK_RATE, sceneRanges } from './timing.ts';
import { theme } from './theme.ts';

type SceneId = (typeof sceneRanges)[number]['id'];

const scenes: Record<SceneId, ComponentType> = {
  'financial-promise': FinancialPromiseScene,
  'ledger-invariants': LedgerInvariantsScene,
  'repository-map': RepositoryMapScene,
  'request-lifecycle': RequestLifecycleScene,
  'atomic-transfer': AtomicTransferScene,
  'data-model': DataModelScene,
  'reviewer-sandbox': SandboxWorkflowScene,
  'captured-evidence': CapturedEvidenceScene,
  observability: ObservabilityScene,
  'aws-review-path': AwsReviewPathScene,
};

export const visualSceneLabels = [
  'Invariantes financieras',
  'Transferencia atómica',
  'Evidencia operativa',
] as const;

export const SuperCoolLedger = () => (
  <AbsoluteFill style={{ background: theme.ink }}>
    <Audio
      src={staticFile('narration-fast.mp3')}
      volume={0.95}
      playbackRate={VIDEO_PLAYBACK_RATE}
    />
    {sceneRanges.map((range) => {
      const Scene = scenes[range.id];
      return (
        <Sequence
          key={range.id}
          from={range.from}
          durationInFrames={range.to - range.from}
          premountFor={30}
        >
          <Scene />
        </Sequence>
      );
    })}
    <CaptionBar />
  </AbsoluteFill>
);

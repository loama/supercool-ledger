import { mkdir } from 'node:fs/promises';

interface ContentPart {
  input_text?: string;
  output_text?: string;
  text?: string;
}

interface SessionEvent {
  type?: string;
  payload?: {
    type?: string;
    role?: string;
    content?: ContentPart[];
    author?: string;
  };
}

interface VisibleMessage {
  role: 'assistant' | 'user';
  text: string;
}

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error('usage:bun scripts/export-ai-history.ts /path/to/session.jsonl');
}

const source = await Bun.file(sourcePath).text();
const events = source
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as SessionEvent);
const messages = events.flatMap((event): VisibleMessage[] => {
  if (event.type !== 'response_item' || event.payload?.type !== 'message') return [];
  if (event.payload.role !== 'assistant' && event.payload.role !== 'user') return [];
  const text = (event.payload.content ?? [])
    .map((part) => part.text ?? part.input_text ?? part.output_text ?? '')
    .join('\n');
  return text ? [{ role: event.payload.role, text }] : [];
});

const firstAssessmentMessage = messages.findIndex(
  (message) => message.role === 'user' && message.text.includes('Problem Statement:'),
);
if (firstAssessmentMessage < 0) throw new Error('assessment_prompt_not_found');
const assessmentMessages = messages.slice(firstAssessmentMessage);

await mkdir('docs/ai-usage', { recursive: true });
await Bun.write(
  'docs/ai-usage/conversation.json',
  `${JSON.stringify({ source: 'visible project conversation', messages: assessmentMessages }, null, 2)}\n`,
);

const quoted = (value: string): string =>
  value
    .split('\n')
    .map((line) => `> ${line.replace(/[ \t]+$/g, '')}`)
    .join('\n');
const markdown = [
  '# Visible AI conversation',
  '',
  'This is a chronological export of user prompts and visible assistant responses beginning with the official assessment. Tool internals, system instructions, secrets, and unrelated earlier design work are excluded.',
  '',
  ...assessmentMessages.flatMap((message, index) => [
    `## ${index + 1}. ${message.role === 'user' ? 'User prompt' : 'Assistant response'}`,
    '',
    quoted(message.text),
    '',
  ]),
].join('\n');
await Bun.write('docs/ai-usage/conversation.md', markdown);

const prompts = new Map<string, string>([
  [
    'framework_review:0',
    'Independently review the technology choice for a financial account balance assessment. The proposed service is a TypeScript service on Bun with Fastify, PostgreSQL, Kysely, OpenAPI, Docker Compose, and Terraform. Compare Fastify accurately with FastAPI and Tornado. Explain that Fastify is JavaScript and TypeScript, while FastAPI and Tornado are Python. Assess whether TypeScript with Fastify is a strong hiring submission for a critical ledger service, and whether Go or Python would be more convincing. Focus on correctness, ecosystem maturity, testability, reviewer familiarity, and scope. Browse current official primary documentation when facts may have changed. Do not edit files. Return a concise recommendation, important tradeoffs, and any architecture changes you would make.',
  ],
  [
    'deployment_review:0',
    'Independently research deployment and infrastructure options for a financial ledger technical assessment. The current proposal uses AWS ECS, RDS, and Terraform, but the user wants a simpler developer experience such as Render. Determine current Render capabilities using only official Render and Terraform provider documentation. Answer whether infrastructure as code can provision a Render web service and PostgreSQL, whether Render Blueprints or Terraform are better for this assessment, and what limitations or tradeoffs matter. Compare briefly with Railway, Fly.io, and AWS only when official primary documentation supports the facts. Recommend the simplest credible local and hosted setup. Do not edit files. Return concise findings, source links, and a recommended deployment story.',
  ],
  [
    'presentation_review:0',
    'Act as a skeptical engineering hiring reviewer and presentation designer. Review the proposed submission concept for SuperCool Finances: a focused account balance microservice with an immutable double entry ledger, PostgreSQL transactions, row locks, idempotency, reconciliation, security, tests, cloud infrastructure, and full AI transcript. Recommend how to present it so a reviewer understands the quality quickly. Consider README structure, Mermaid diagrams, architecture decision records, OpenAPI, a scripted demo, test evidence, a hosted demo, and whether a short Remotion video adds value or becomes distraction. Suggest a tight repository walkthrough and demo narrative. Identify scope cuts and any missing technical or presentation feature. Do not edit files. Return a prioritized recommendation and your judgment on video.',
  ],
  [
    'round1_security:0',
    'You are reviewer one in formal review round one. Independently audit the repository at /Users/eduardo/Documents/Codex/2026-08-25/i-j/work/supercool-ledger for financial correctness and security. Do not edit files. Review the complete branch, including PostgreSQL schema and triggers, transfer transaction, locking, idempotency, money representation, authentication, tenant isolation, error handling, audit records, secrets, and adversarial tests. Run safe read only commands and tests as useful. Inspect actual code, not only documentation. Report findings ordered by severity. Each finding must include severity, precise file and line, failure or attack scenario, evidence, and a concrete fix. Also list strong controls that you verified and any uncertain assumptions. If no defect exists in an area, say so rather than inventing one. Return your complete review response to the parent.',
  ],
  [
    'round1_operations:0',
    'You are reviewer two in formal review round one. Independently audit the repository at /Users/eduardo/Documents/Codex/2026-08-25/i-j/work/supercool-ledger for implementation quality and operations. Do not edit files. Review TypeScript and Fastify design, database lifecycle, migrations, reconciliation, logs, metrics, traces, Sentry behavior, OpenAPI, Docker, Render Blueprint, CI, dependency configuration, tests, failure behavior, and developer reproducibility. Run safe read only commands and tests as useful. Inspect actual code and configuration. Report findings ordered by severity. Each finding must include severity, precise file and line, evidence, operational impact, and a concrete fix. Also list strengths you verified and any uncertain assumptions. Do not create speculative findings without evidence. Return your complete review response to the parent.',
  ],
  [
    'round1_presentation:0',
    'You are reviewer three in formal review round one. Independently audit the repository at /Users/eduardo/Documents/Codex/2026-08-25/i-j/work/supercool-ledger as a hiring panel reviewer focused on presentation, documentation, and video. Do not edit files. Review the README reviewer path, architecture and threat model, Mermaid diagrams, ADRs, OpenAPI examples, AI disclosure completeness, demo credibility, Remotion source, ElevenLabs narration, rendered MP4, poster, visual clarity, factual agreement with captured PostgreSQL evidence, accessibility, and whether the assessment is easy to evaluate. Inspect representative video frames and media metadata. Run safe read only commands or tests as useful. Report findings ordered by severity. Each finding must include severity, precise file and line or video timestamp, evidence, reviewer impact, and a concrete fix. Also list strengths you verified and any uncertain assumptions. Do not reward polish that is unsupported by executable evidence, and do not invent issues. Return your complete review response to the parent.',
  ],
  [
    'round2_security:0',
    'You are reviewer one in formal review round two. Independently audit the repository at /Users/eduardo/Documents/Codex/2026-08-25/i-j/work/supercool-ledger for financial correctness and security. Do not edit files and do not assume any earlier review was correct or complete. Review the complete current branch, including every migration, database constraint and trigger, transfer transaction, concurrency, idempotency, money bounds, authentication, tenant suspension and isolation, reconciliation, audit events, error behavior, dependencies, secrets, and adversarial tests. Run safe read only commands and tests as useful. Inspect code rather than trusting documentation. Report findings ordered by severity. Every finding must include severity, precise file and line, a concrete failure or attack scenario, evidence, and a specific fix. Also list verified strengths and uncertain assumptions. Do not invent findings. Return your complete review response to the parent.',
  ],
  [
    'round2_operations:0',
    'You are reviewer two in formal review round two. Independently audit the repository at /Users/eduardo/Documents/Codex/2026-08-25/i-j/work/supercool-ledger for implementation quality and operations. Do not edit files and do not rely on earlier review conclusions. Review TypeScript and Fastify structure, migration serialization, schema readiness, database lifecycle, reconciliation, audit behavior, logs, metrics, trace parenting, Sentry, OpenAPI and documentation UI, Docker, Render Blueprint, CI, production dependencies, tests, and local reproducibility. Run safe read only commands and tests as useful. Report findings ordered by severity. Every finding must include severity, precise file and line, evidence, operational impact, and a concrete fix. Also list verified strengths and uncertain assumptions. Avoid speculative findings. Return your complete review response to the parent.',
  ],
  [
    'round2_presentation:0',
    'You are reviewer three in formal review round two. Independently audit the repository at /Users/eduardo/Documents/Codex/2026-08-25/i-j/work/supercool-ledger as a hiring panel reviewer focused on presentation, documentation, and video. Do not edit files and do not rely on earlier review conclusions. Review the README path, architecture, threat model, operations guide, Mermaid diagrams, ADRs, OpenAPI examples, AI disclosure, review records, executable demo, Remotion source, captions, ElevenLabs narration, rendered MP4, poster, accessibility, media metadata, and factual agreement with current PostgreSQL evidence. Inspect representative frames and run safe read only checks as useful. Report findings ordered by severity. Every finding must include severity, precise file and line or video timestamp, evidence, reviewer impact, and a concrete fix. Also list verified strengths and uncertain assumptions. Do not invent issues. Return your complete review response to the parent.',
  ],
]);

const recoveryPrompt =
  'For the assessment AI disclosure, return the exact initial task prompt you received in this thread, verbatim if available. Then repeat your complete original response verbatim. Do not add new analysis.';
prompts.set('framework_review:1', recoveryPrompt);
prompts.set('deployment_review:1', recoveryPrompt);
prompts.set('presentation_review:1', recoveryPrompt);

const agentCounts = new Map<string, number>();
const agentInteractions = events.flatMap((event) => {
  if (event.type !== 'response_item' || event.payload?.type !== 'agent_message') return [];
  const author = event.payload.author?.replace('/root/', '');
  if (!author) return [];
  const occurrence = agentCounts.get(author) ?? 0;
  agentCounts.set(author, occurrence + 1);
  const prompt = prompts.get(`${author}:${occurrence}`);
  if (!prompt) return [];
  const raw = (event.payload.content ?? [])
    .map((part) => part.text ?? part.input_text ?? part.output_text ?? '')
    .join('\n');
  const response = raw.replace(
    /^Message Type: FINAL_ANSWER\nTask name: \/root\nSender: [^\n]+\nPayload:\n/,
    '',
  );
  return [{ author, occurrence, prompt, response }];
});

const reviewMarkdown = [
  '# Independent AI review records',
  '',
  'This file preserves every prompt and complete response from the three architecture advisers and both formal review rounds. The main adjudication and applied corrections are recorded in `docs/reviews/round-1.md` and `docs/reviews/round-2.md`.',
  '',
  ...agentInteractions.flatMap((interaction, index) => [
    `## ${index + 1}. ${interaction.author}`,
    '',
    '### Prompt',
    '',
    quoted(interaction.prompt),
    '',
    '### Complete response',
    '',
    quoted(interaction.response),
    '',
  ]),
].join('\n');
await Bun.write('docs/ai-usage/review-records.md', reviewMarkdown);

process.stdout.write(
  `${JSON.stringify({ messages: assessmentMessages.length, agentInteractions: agentInteractions.length, output: 'docs/ai-usage' })}\n`,
);

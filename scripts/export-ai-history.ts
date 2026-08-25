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
const messages = source
  .split('\n')
  .filter(Boolean)
  .flatMap((line): VisibleMessage[] => {
    const event = JSON.parse(line) as SessionEvent;
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
    .map((line) => `> ${line}`)
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

process.stdout.write(
  `${JSON.stringify({ messages: assessmentMessages.length, output: 'docs/ai-usage' })}\n`,
);

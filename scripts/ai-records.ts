import { format } from 'prettier';
import type { RedactableMessage } from './ai-redaction.ts';

export const quoted = (value: string): string =>
  value
    .split('\n')
    .map((line) => {
      const trimmed = line.replace(/[ \t]+$/g, '');
      return trimmed ? `> ${trimmed}` : '>';
    })
    .join('\n');

export const renderConversationMarkdown = async (
  messages: RedactableMessage[],
): Promise<string> => {
  const markdown = [
    '# Visible AI conversation',
    '',
    'This is a chronological export of user prompts and visible assistant responses beginning with the official assessment. Private workspace context, credentials, authenticated account state, local paths, and unrelated project details are replaced with explicit redaction markers.',
    '',
    ...messages.flatMap((message, index) => [
      `## ${index + 1}. ${message.role === 'user' ? 'User prompt' : 'Assistant response'}`,
      '',
      quoted(message.text),
      '',
    ]),
  ].join('\n');
  return format(markdown, { parser: 'markdown', proseWrap: 'preserve' });
};

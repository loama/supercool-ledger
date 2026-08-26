import { expect, test } from 'bun:test';
import { redactConversationMessages, redactReviewRecord } from '../../scripts/ai-redaction.ts';

test('redacts an entire credential search exchange', () => {
  const result = redactConversationMessages([
    {
      role: 'user' as const,
      text: 'find the api key in my supervisor project .env or from chrome',
    },
    { role: 'assistant' as const, text: 'I will check the Supervisor environment files first.' },
    { role: 'assistant' as const, text: 'API key inventory and account state are redacted.' },
    { role: 'assistant' as const, text: 'Enrique was selected. Saved account state is redacted.' },
    { role: 'assistant' as const, text: 'The new narration finished successfully.' },
  ]);

  expect(result.slice(0, 4).every(({ text }) => text === result[0]?.text)).toBe(true);
  expect(result[0]?.text).toBe('[REDACTED: private credential search exchange]');
  expect(result[4]?.text).toBe('The new narration finished successfully.');
});

test('removes environment and local workspace context', () => {
  const [result] = redactConversationMessages([
    {
      role: 'user' as const,
      text: '<in-app-browser-context source="ambient-ui-state"><workspace_roots>/Users/person/private</workspace_roots></in-app-browser-context>',
    },
  ]);

  expect(result?.text).toBe('[REDACTED: private workspace context]');
});

test('redacts private hosting plan and workspace messages', () => {
  const [result] = redactConversationMessages([
    {
      role: 'assistant' as const,
      text: 'The paid PostgreSQL 17 instance is provisioning in Eduardo López’s Workspace.',
    },
  ]);

  expect(result?.text).toBe('[REDACTED: private hosting account context]');
});

test('redacts authenticated account state and deployment identifiers', () => {
  const result = redactConversationMessages([
    { role: 'user' as const, text: 'signed into github' },
    {
      role: 'assistant' as const,
      text: 'Deployment dep-da73ioe7bikc73epqtcg is visible at https://dashboard.render.com/example.',
    },
  ]);

  expect(result[0]?.text).toBe('[REDACTED: private hosting account context]');
  expect(result[1]?.text).not.toContain('dep-da73ioe7bikc73epqtcg');
  expect(result[1]?.text).not.toContain('dashboard.render.com');
});

test('redacts local paths in independent review records', () => {
  const result = redactReviewRecord(
    '[source](/Users/person/work/project/src/app.ts:20) and [file](file:///Users/person/work/file.ts#L4)',
  );

  expect(result).not.toContain('/Users/');
  expect(result).toContain('[REDACTED_LOCAL_PATH]');
});

test('preserves ordinary assessment content', () => {
  const [result] = redactConversationMessages([
    { role: 'assistant' as const, text: 'PostgreSQL applies the transfer atomically.' },
  ]);

  expect(result?.text).toBe('PostgreSQL applies the transfer atomically.');
});

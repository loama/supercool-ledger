import { redactConversationMessages, redactReviewRecord } from './ai-redaction.ts';
import { renderConversationMarkdown } from './ai-records.ts';

interface ConversationRecord {
  source: string;
  messages: { role: 'assistant' | 'user'; text: string }[];
}

const conversationPath = 'docs/ai-usage/conversation.json';
const conversation = (await Bun.file(conversationPath).json()) as ConversationRecord;
const messages = redactConversationMessages(conversation.messages);
await Bun.write(conversationPath, `${JSON.stringify({ ...conversation, messages }, null, 2)}\n`);
await Bun.write('docs/ai-usage/conversation.md', await renderConversationMarkdown(messages));

const reviewPath = 'docs/ai-usage/review-records.md';
await Bun.write(reviewPath, redactReviewRecord(await Bun.file(reviewPath).text()));

process.stdout.write(`${JSON.stringify({ messages: messages.length, output: 'docs/ai-usage' })}\n`);

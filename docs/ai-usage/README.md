# AI usage record

`conversation.json` is the canonical export of every visible user prompt and assistant response beginning with the official assessment. `conversation.md` presents the same record for human review.

The export intentionally excludes hidden instructions, internal reasoning, tool traffic, credentials, and the earlier unrelated product design discussion. Independent agent review prompts and responses appear in `review-records.md` because those exchanges are not user visible conversation messages.

Regenerate the visible conversation with:

```bash
bun run ai:export /absolute/path/to/session.jsonl
```

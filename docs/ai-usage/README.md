# AI usage record

`conversation.json` is the canonical export of every visible user prompt and assistant response beginning with the official assessment. `conversation.md` presents the same record for human review.

The export intentionally excludes hidden instructions, internal reasoning, and tool traffic. Before either output is written, deterministic redaction replaces private workspace context, local paths, authenticated account state, credential search exchanges, hosting plan details, and unrelated project references with explicit markers. The same path redaction is applied to independent agent prompts and responses in `review-records.md`.

Regenerate the visible conversation with:

```bash
bun run ai:export /absolute/path/to/session.jsonl
```

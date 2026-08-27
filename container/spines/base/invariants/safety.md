### Safety

- No destructive ops (`rm -rf`, force-push, DB drops) without explicit session auth; auth doesn't carry across sessions.
- Never commit/log/transmit secrets, tokens, or PII.
- Investigate unfamiliar state before modifying; don't delete files you didn't create; save user work.

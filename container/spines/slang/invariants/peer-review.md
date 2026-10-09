### Peer-review-before-report rule

- Dispatch `[Fix Review Request]` to `slang-reviewer` (when in destinations) *before* `[Fix Report]`. This is additional to the `CODE_REVIEW` codex critique, not a substitute — codex reads the diff; the reviewer builds it, runs Devin, checks clarity.
- Only legitimate skips: A/B-test mode, or `slang-reviewer` not in destinations. Patch mode is not a skip. State the reason in the report when you skip.
- After dispatching, end the turn; handle the reply per the fix workflow's **Peer review** step (two rounds at most).

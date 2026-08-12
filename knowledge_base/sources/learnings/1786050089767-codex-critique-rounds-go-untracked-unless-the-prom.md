# codex-critique rounds go untracked unless the prompt carries the literal STAGE: token

## The defect

A genuine `mcp__codex__codex` critique can run, return a verdict, and still be recorded as **never
invoked** — producing a false `[GATE AUDIT] … codex-critique … was never invoked in this session —
gate skipped` on every subsequent message that mentions a gated phrase.

Cause, in `/app/hooks/track-critique.sh`:

```bash
:58  STAGE=$(grep -m1 -oE 'STAGE:[[:space:]]*[A-Z_]+' <<< "$PROMPT" ...)
```

`STAGE` is parsed from the **prompt**, and it requires the literal token `STAGE:`. A prompt that
opens with the stage *name* followed by a colon — e.g. `CODE_REVIEW: review this diff…`, which reads
perfectly naturally — does **not** match. `STAGE` comes back empty, and every stage-gated code path
downstream is skipped, including the increment.

Verified with a control so "no match" can't be a broken matcher:

| prompt | matches `STAGE:[[:space:]]*[A-Z_]+` |
|---|---|
| `CODE_REVIEW: independent critique…` | **no** ⇒ untracked, silently |
| `STAGE: CODE_REVIEW` | yes (control) |

## Why it's worse than the failure it hides

There is a *separate* guard at `:161-168` (instruction-pinning: requires the developer-instructions
to contain both "You are an independent reviewer" and "Return ONLY the structured output below",
`CRITIQUE_PIN_INSTRUCTIONS=0` disables). When **that** rejects a round it at least emits a receipt:

> Critique round NOT recorded: this codex call carried STAGE: … but its developer-instructions do
> not match the canonical /codex-critique reviewer block.

But the pin is itself gated on `STAGE` being non-empty. So a missing `STAGE:` token skips the pin
entirely — **no receipt, no increment, no diagnostic of any kind.** Absence of that receipt therefore
does **not** mean the pin passed; it may mean your call never reached the pin. Don't use the receipt's
absence as evidence either way.

## What to do

- **Prefix the prompt with the literal token**: `STAGE: CODE_REVIEW` on its own line, then the review
  request. Use the `/codex-critique` skill's developer-instructions verbatim so the pin also passes.
- **Don't re-run a real critique purely to increment the counter.** If the review genuinely happened
  and its findings were acted on, re-issuing it in canonical form only to satisfy a tracker is
  laundering the control. Report the situation honestly instead: critique ran, verdict X, finding
  fixed, round likely untracked due to the `STAGE:`-token defect.
- **Read the reviewer's own `### Verdict` section**, never the hook's pass/fail — the gate fails open
  and, per this defect, can also fail *closed* on a real round.

## Generalisation

This is the standard shape: an instrument whose output is formatted identically whether or not it
measured the thing. The audit message asserts "never invoked" when it can only observe "counter not
incremented" — two different propositions. When a gate audit contradicts something you know you did,
suspect the counter's write path before you doubt your own action, and go read the hook.

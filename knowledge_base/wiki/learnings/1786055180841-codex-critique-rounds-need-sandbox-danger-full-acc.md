---
title: "codex-critique rounds need sandbox=danger-full-access, or nothing records"
type: learning
topic: agent-ops
source: learnings/1786055180841-codex-critique-rounds-need-sandbox-danger-full-acc.md
---

# codex-critique rounds need sandbox=danger-full-access, or nothing records

## The defect (and it is usually yours, not the tooling's)

If your `mcp__codex__codex` critique rounds never appear in `critique_stages` — so
`gate-critique-on-deliver.sh` keeps blocking `gh pr create` with *"missing critique stages"* — check
the `sandbox` parameter **before** you investigate the hooks.

The `codex-critique` SKILL.md says, in bold at the top:

> **IMPORTANT: Always pass `sandbox: "danger-full-access"`.** Any other value (including
> "read-only") will be rejected by a PreToolUse hook — bwrap sandboxing does not work inside Docker
> containers.

Passing `sandbox: "read-only"` seems obviously right for a read-only review, and it is wrong here.
The call is rejected upstream, so `developer-instructions` never reaches `track-critique.sh`, the
sentinel check fails against an empty string, and the round is not recorded as a stage.

**All three ingredients are required simultaneously:**

1. `STAGE: <NAME>` as the **first line** of the prompt (`PROMPT` is truncated to 500 bytes before the
   `STAGE:` grep, so a token further in is invisible).
2. The skill's reviewer block passed **verbatim** in the `developer-instructions` parameter — not
   inside the prompt (the hook reads `.tool_input."developer-instructions"`).
3. `sandbox: "danger-full-access"`.

Get all three right and the round records immediately: `stages: CODE_REVIEW=1; verdicts:
CODE_REVIEW=approve`.

## The expensive part was the misdiagnosis

I spent many rounds root-causing hook internals. I verified in isolation that my instruction text
(829 bytes), `head -c 2000`, both `grep -q` sentinel calls, a `jq -r` JSON round-trip, and both
accepted key spellings **all passed** — and concluded the hook was falsely rejecting valid text. A
peer concluded the pin "never ran." Both wrong: the call never got far enough for either story to
apply.

Every one of those measurements was correct **and about the wrong object**. I never tested the one
thing that mattered: *the call's own parameters against the tool's documented contract.*

⇒ **Before debugging a tool's internals, re-read the tool's own usage doc.** I read the hook's source
four times and the skill's instructions once, carelessly. The answer was in the shorter document, in
bold, at the top.

## Two related traps worth knowing

- **`codex-reply` is pin-exempt** (replies carry no instructions; the thread was pinned at its
  initial call), so replies increment `critique_rounds` while writing **no** stage row. A state of
  `critique_rounds: 4` with `critique_stages: None` is exactly what rejected-initials +
  accepted-replies produces — it does not mean the counter is broken.
- **The "NOT recorded" receipt interpolates `$STAGE`.** If you see your stage *name* in that receipt,
  `STAGE` parsed and the pin genuinely ran and rejected. If you see no receipt at all, the pin never
  ran. The receipt is the discriminator between those two very different failures.

## Do not clear the gate by weakening it

`CRITIQUE_PIN_INSTRUCTIONS=0` is a documented disable, but setting it yourself makes the record read
"gate satisfied" when the truth is "gate bypassed" — a durable falsehood in the artifact a human
audits. A broken counter is merely uninformative; a self-cleared gate is a lie. Escalate, or find the
contract you are violating. In this case the contract was three lines of the skill file.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786055180841-codex-critique-rounds-need-sandbox-danger-full-acc.md`_

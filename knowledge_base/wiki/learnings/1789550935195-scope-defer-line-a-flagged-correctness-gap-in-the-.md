---
title: "Scope-defer line: a flagged correctness gap in the mechanism you're changing is in-scope, never a follow-up"
type: learning
topic: misc
source: learnings/1789550935195-scope-defer-line-a-flagged-correctness-gap-in-the-.md
---

# Scope-defer line: a flagged correctness gap in the mechanism you're changing is in-scope, never a follow-up

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-16T09:28:55.195Z
---

# Scope-defer line: a flagged correctness gap in the mechanism you're changing is in-scope, never a follow-up

## Rule

When deciding whether to defer something as a follow-up on a PR, the line is **not** "how big is it" — it is **"is this a correctness gap in the mechanism this PR is changing, or an independent enhancement?"**

- **Correctness gap in the exact code path you're editing → in-scope by definition.** Reproduce it and close it, or prove it unreachable and say why. Never park it as "later," *especially* if a reviewer/codex already flagged it.
- **Independent enhancement (different mechanism, needs its own design call) → correctly deferrable.** File a turnkey follow-up issue with the concrete example + the open design question, document it in the PR body, and move on. (e.g. slang#13084 deferring member/subscript/return-value *source-shape* generalization to a csyonghe design call — a genuinely separate mechanism — was right.)

Do **not** over-correct this into defensive scope-creep ("widen everything so I never miss"). Deferral remains the discipline for independent scope; the fix is a sharper criterion, not "defer nothing."

## Why (grounding failure)

slang#12563 (pointer address-space reconciliation). In **round 28**, codex flagged a "via-call" gap: a pointer-returning call with NO pointer args (`int* pick(){ return &gShared; }`) never reconciles the call-result address space, because the `!hasSpecializableArg` early-`break` skips the only reconciliation site. The fixer **scoped it out as a follow-up**. Rounds of review after that were all reading/layering/wording. The maintainer (pdeayton-nv) then found it **BLOCKING** by *running the compiler* — it produces an OpFunctionCall type mismatch → invalid SPIR-V, and is the simplest case of the very issue (#12498) the PR was meant to fix. The scoped-out item was a correctness hole in the exact path being edited, not an independent enhancement — so it should never have been parked.

## Corollary — execution-first for codegen/SPIR-V changes

Reading/layering/wording review is **structurally blind** to this bug class: nobody had compiled a pointer-returning function across ~28 rounds. For codegen/SPIR-V PRs, verification must be **execution-first**: reproduce → fix → **compile the actual shape and run SPIR-V validation** on it. This is the order reviewers should run for codegen PRs, not just fixers — a diff can look correct at every layer and still emit invalid SPIR-V for a shape nobody instantiated.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789550935195-scope-defer-line-a-flagged-correctness-gap-in-the-.md`_

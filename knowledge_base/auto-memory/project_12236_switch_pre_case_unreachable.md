---
name: project_12236_switch_pre_case_unreachable
description: "slang#12236 — statements before first switch case not diagnosed unreachable; HELD, dedup"
metadata: 
  node_type: memory
  type: project
  originSessionId: a7bb3962-d707-4bc2-9d46-2cc93a20a43f
---

# slang#12236 — statements before first `case` label not diagnosed as unreachable

Filed 2026-07-27 by **skiminki-nv** (`Dev Opened`). In a `switch`, statements written before the first `case`/`default` label are unconditionally unreachable (Slang disallows Duff's-device fallthrough) but are **silently discarded** — no diagnostic. Statements after a `break` *are* correctly reported (E41000). Repro: `slangc -target spirv` on a compute shader with `output[0]=99;` before `case 0:`.

**Triage verdict (slang-triager, 07-27):** Confirmed bug / missing diagnostic. Severity **low / P3**. Component: IR-lowering + diagnostics (frontend). Root cause: `lowerSwitchCases()` at `slang-lower-to-ir.cpp:9305` silently ignores statements before the first case/default (never lowered → never reaches E41000 site at :8228). REPRODUCED @HEAD `70462843c`. Verdict 5-bullet posted → issue comment `5094677722`. Labels added: `reproduced` + `Missing Diagnostic`.

**Dedup:** SAME root cause as **#9999** (broader "switch with no cases" variant) — author's "likely same as #9999" confirmed; one fix at :9305 covers both. #12222 (lexer UTF-8) is unrelated/distinct.

**State: FIXED — PR #12245 OPEN, in review.** jkwak-work (`jkwak-work`, MEMBER) commented `@nv-slang-bot Make a PR` (comment `5097204405`) 07-27 → go-ahead routed through triager → fixer implemented **Approach A**.

**PR #12245** — https://github.com/shader-slang/slang/pull/12245 — 2 files +38/−8: `slang-lower-to-ir.cpp` (:9305 branch emits existing **E41000** once-per-leading-run via new `SwitchStmtInfo::warnedUnreachableBeforeFirstCase` flag) + new `tests/diagnostics/switch-unreachable-before-case.slang`. **No new diag number** (reuses E41000 `slang-diagnostics.lua:4869` → cluster collision moot). `closingIssuesReferences=[12236]` ONLY — **#9999 correctly NOT closed** (fixer verified `visitSwitchStmt` early-returns before `lowerSwitchCases` on zero-label switch, so this fix can't reach #9999's no-cases case). Tests: repro PASS (pre-case + post-break both E41000), 3-stmt leading run = exactly 1 warning, tests/diagnostics 707/707.

Review: codex CODE+PLAN+OUTPUT all APPROVE (6 rounds). **In MAINTAINER review** — jkwak-work himself flipped PR draft→ready (`ready_for_review` 2026-07-27T23:54:42Z) and auto-requested real reviewers pdeayton-nv + skiminki-nv (`reviewDecision=REVIEW_REQUIRED`). jkwak asked an inline question (r3661775282: a removed comment re a future `LabelStmt`); fixer proved not-a-false-positive (Slang labels are structured break/continue targets only, no goto; `break myLabel` into pre-case labeled stmt rejected E30053 → still genuinely unreachable). Trace: comment orig commit 59a4c0ca / PR #278 (T. Foley 2017).

**Draft flag RESOLVED — no guardrail issue:** fixer DID create it as a draft (correct per [[feedback_drafts_only_guardrail]]); the maintainer deliberately flipped it ready. Not a bot action. **slang-reviewer stood down by Main 07-28** — the internal review req assumed a bot-held draft; maintainer taking it public + requesting real reviewers voids that premise (redundant lane). Merge remains operator/maintainer-gated.

**Review signal (07-28):** skiminki-nv posted **LGTM (COMMENTED, non-blocking — NOT merge auth)**. Internal reviewers: B(Devin) done, C(clarity) done, A(correctness) still settling → all held file-only, no GitHub post, no PR action (stood down; maintainer-driven lane is authoritative). Likely change-request vector = the **warning-vs-error design fork** (same severity split as #9999: could maintainers ask to convert E41000-warning → an error?). If they do, that's a scope change, not a defect in this PR.

On merge: triager re-reads diff, refreshes issue verdict, forwards final resolution up. #9999 stays a separate design-fork (jhelferty E30606-error vs skiminki E41000-warning) — do not conflate. **Merge is maintainer/operator-gated — bot never merges or flips PR state.**

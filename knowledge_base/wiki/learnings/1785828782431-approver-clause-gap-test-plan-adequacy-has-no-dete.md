---
title: "[approver/clause-gap] Test-plan adequacy has NO deterministic clause and cannot get one — the both-directions control belongs in the Step-3 challenger, and its durable home is .instructions.md, not the synced SKILL.md"
type: learning
topic: review-approval
source: learnings/1785828782431-approver-clause-gap-test-plan-adequacy-has-no-dete.md
---

# [approver/clause-gap] Test-plan adequacy has NO deterministic clause and cannot get one — the both-directions control belongs in the Step-3 challenger, and its durable home is .instructions.md, not the synced SKILL.md

## Symptom

The orchestrator forwarded a generalizable review defect from the shader-slang/slang #11917 pass-gating epic (2026-08-04) and asked to "file it against whatever clause covers test-plan adequacy." The defect shape: a flag is **declared and gated on but never set** (no scan arm writes it), so the guarded work never happens on any input — while *every* artifact an approval pipeline consumes is green. Byte-identical output is green *by construction* (skipped work changes nothing); tests pass (none asserted the work happened); no reviewer objects (nobody looks for an unsatisfiable condition). Full write-up: `1785827882400-reviewing-a-pass-gating-pr-green-tests-plus-byte-i.md`.

Two things were wrong with the framing, and both are the transferable part:

## Root cause 1 — no clause covers test-plan adequacy, and none *can*

`eval-clauses.py` is data-only by construction: "it never judges the code and never reasons: every clause is a mechanical predicate over PR metadata + the changed paths at the pinned commit (read-only gh) and the policy file" (`eval-clauses.py:5-6`). The six clauses are `author_trust`, `head_provenance`, `commit_match`, `ci_green_on_sha`, `no_protected_paths`, `tier_eligible` (+size caps) — all metadata/path predicates.

"Does this PR's test plan contain a trigger-present control?" requires reading the diff, finding each new flag, and locating its setter. That is judgment over code, which is **Step 3 (challenger + gap severity)**, not Step 1. Writing it as a clause would produce an unimplementable predicate that lands `unevaluable` → a spurious `ABSTAIN_INFRA` on every PR, corrupting the infra-abstain rate that is supposed to be driven to ~0. **The Step-1/Step-3 boundary is data-vs-judgment; route any "the reviewer should ask X" request to Step 3 regardless of how it was framed upstream.**

## Root cause 2 — the writable skill file is not the durable one

`/home/node/.claude/skills/slangpy-pr-approver/SKILL.md` is writable, which makes it the obvious target. It is the wrong one: `.external-skills.json` lists `slangpy-pr-approver` as synced from `shader-slang/slang-skills@main`, so local edits are re-synced away. Two prior atoms record exactly this cost — `1784187372743` (approver skill "lives in external shader-slang/slang-skills@main … local edits are re-synced away") and `1785112718566` (a supervise-issues `scan.py` fix "re-derived by hand each tick" across ticks 89/91/94/96/98/104 because it "reverts on every skill re-sync").

The durable home is the group overlay **`/workspace/agent/.instructions.md`**, which composes verbatim into `CLAUDE.md`'s `## Additional Instructions` (headers demoted `##` → `####`). Verified: unchanged mtime across ~26 days of restarts, and the new block re-appeared in the recomposed `CLAUDE.md:559` after the container restart that applied it.

## How to catch it

- Before editing any file under `/home/node/.claude/skills/`, check `.external-skills.json` for that skill name. Present ⇒ the edit is ephemeral; put behavior in `.instructions.md` (durable, no approval needed) and file an upstream PR if the *skill* genuinely needs it.
- Confirm durability the honest way: after `request_restart` (or an instructions-update restart), grep the recomposed `CLAUDE.md` for your text. Writability is not durability.

## Fix

Added a `## Standing challenger probes (Step 3; no Step-1 clause can carry these)` section to `.instructions.md` — now `CLAUDE.md:559-579` — carrying: (a) negative safety evidence needs a positive control (ask whether the observation could have come out any other way; if not it carries zero bits); (b) conditional changes require a **both-directions control** — condition false → path skipped, *and* condition true → path taken and observably did its job — plus the three cheap concrete reads from the source write-up: **find the write that sets each new flag (a flag with no setter is dead — that is a diff read, not a drill)**, count *jobs* not passes, and check pipeline order (a guard set by a scan running after the guarded work is equally dead); (c) a conditional change whose test plan has no trigger-present control is `ABSTAIN_POLICY:OPEN_GAP`, not a nit.

## Related

Same family as *a zero without a non-zero control is not evidence* and the discrimination question — "would this signal have looked different if the opposite were true?" (`1785750713482`). This is the **test-plan-side** instance: the drill proves the change doesn't break things and structurally cannot prove it does anything. Sibling instances already filed: `1785775152713` (byte-identical SPIR-V could not express the IR-level contract — the demanded artifact was impossible before it was run) and `1785775240063` (an argument citing real file:line that cannot bear on the guarded path). Provenance checks catch none of these; only method does.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785828782431-approver-clause-gap-test-plan-adequacy-has-no-dete.md`_

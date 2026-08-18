---
title: "devin-fetch done-guard: a partial CI rail is not a verdict — the class stayed open for 12 recorded instances because the fix was never wired into the artifact"
type: learning
topic: ci-tooling
source: learnings/1786121384159-devin-fetch-done-guard-a-partial-ci-rail-is-not-a-.md
---

# devin-fetch done-guard: a partial CI rail is not a verdict — the class stayed open for 12 recorded instances because the fix was never wired into the artifact

# `devin-fetch.sh` exit 0 false-clean: FIXED in the nanoclaw copy (PR #1145), still open in the slang copy

**Status 2026-08-07.** Two defects that make `devin-fetch.sh` exit 0 without ever
scraping Devin's verdict are now fixed and tested in
`container/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh`
(slang-coworkers/nanoclaw PR **#1145**, branch
`fix/nv-main/devin-done-guard-partial-rail`). Both were reproduced on my own
edge, not taken on report.

## The two causes

1. **The done-guard accepted `Checks <n>/<m>` for ANY n, m.** That counter is
   GitHub's CI rail — how many checks have finished. It says nothing about
   whether Devin's analysis rendered. Observed live on **shader-slang/slang-rhi#815
   at `Checks 12/22`**: exit 0, verdict never scraped, first recorded as "Devin
   found nothing".
   Fix: require a settled rail (`passed === total`).
2. **Nothing ever clicked `View results`.** Devin renders the
   `Devin's AI analysis` heading with findings still collapsed behind that
   button; the scrape then captures the surrounding page (PR description, CI
   rail) and yields an empty Flags section that reads as a clean pass.
   `grep -c 'View results'` → **0 in every revision of the file**, even though a
   manual-recovery note for it has been in the learnings since 2026-05-20.
   Fix: click it before scraping.

## Why this class survived so long — the transferable lesson

⭐⭐⭐ **12 shared learnings record this exact false-clean, spanning 2026-05-20 →
2026-08-05. SIX of them postdate 2026-07-10 — the last commit to touch the
file.** The class was being *re-recorded as lessons* while the artifact went
unchanged. A learning that names a defect is an observation; only an edit to the
file that executes is a countermeasure. When you find yourself writing the Nth
atom about one defect, the correct action is a diff, not an N+1th atom.

⭐⭐ **The fix must not be bought by regressing the fix it replaces.** The
`Checks n/m` alternative was ADDED deliberately in `d8ab9259a` (2026-07-10) to
stop false 30-min timeouts on a settled page whose "All checks passed" banner
had not yet rendered. Requiring equality keeps that case working. It is pinned
as a named test case (`JULY-10 REGRESSION TARGET`) so the next person tightening
this guard cannot silently undo it.

## The test, and arming it

`scripts/devin-done-guard.test.mjs` **extracts the live `DONE_EXPR` out of the
`.sh` and `eval`s it in node**, so it exercises the shipped expression and
cannot drift from a copy. ✅ **Armed before being trusted**: run against the
pre-patch script it fails **2/9**; after, **9/9**. A guard test that has never
failed on demand is decoration — swap in the old blob and confirm red first.

Run: `node container/skills/nanoclaw-pr-review-runner/scripts/devin-done-guard.test.mjs`

## ⚠️ STILL OPEN: the `slang-pr-review-runner` copy has no git home

Measured: `slang-pr-review-runner/scripts/devin-fetch.sh` (331 lines — a
superset with the 2026 Bugs/Flags UI split and the `json.loads` decode) is
**absent from all 402 refs** in slang-coworkers/nanoclaw (control: the nanoclaw
copy hits on 7 refs, so the sweep works). Only the 187-line nanoclaw copy is
version-controlled.

⇒ I patched the live slang copy on my own container (both fixes + an 11-case
ported test, PASS; unpatched control 2/11 FAIL), **but `/home/node/.claude/skills/`
is per-container state, not a durable artifact** — it is
`/dev/vda1[…/data/v2-sessions/ag-…/.claude-shared]`. Any other coworker's copy,
and any rebuilt container, still carries the defect.

⭐ **If you run Devin from `slang-pr-review-runner`, check your own copy before
trusting an exit 0:**
```
grep -c checksSettled  ~/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh   # 0 ⇒ defective
grep -ci 'view results' ~/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh  # 0 ⇒ defective
```
Whoever owns where that copy is authored should land the same two edits there.

## Interim reading rule while any copy is unfixed

`devin-fetch.sh` exit 0 means *the scrape succeeded*, never *an analysis was
obtained*. Before folding a Devin result into a decision, confirm the artifact
carries a real verdict — a non-empty Flags/Bugs section, not just a heading plus
a CI counter. This matters most on the **Devin-only tier**, which is reached
exactly when no bot review exists to contradict a fabricated all-clear.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786121384159-devin-fetch-done-guard-a-partial-ci-rail-is-not-a-.md`_

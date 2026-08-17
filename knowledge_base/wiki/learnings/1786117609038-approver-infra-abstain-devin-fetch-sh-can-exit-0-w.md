---
title: "[approver/infra-abstain] devin-fetch.sh can exit 0 with a false-clean empty Flags section (checks panel satisfies done-guard)"
type: learning
topic: review-approval
source: learnings/1786117609038-approver-infra-abstain-devin-fetch-sh-can-exit-0-w.md
---

# [approver/infra-abstain] devin-fetch.sh can exit 0 with a false-clean empty Flags section (checks panel satisfies done-guard)

# devin-fetch.sh exit 0 does not prove Devin produced a flags verdict

Observed on shader-slang/slangpy PR #1095 (runner: `/home/node/.claude/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh`).

## Symptom
Script exited **0** and wrote a well-formed `devin-flags.md` (5063 B, passes the
`DEVIN_MIN_BYTES` guard, no "Generating…"), but the `## Flags` section was
**empty**. Read naively that looks like "Devin found no problems" — a false-safe.
The only `bug`-ish grep hits were the substring in `CompilerOptionName::DebugInformation`
and the literal `## Flags` heading.

## Root cause (two independent defects compounding)
1. **The done-predicate accepts a CI-checks signal as a flags verdict.** `DONE_EXPR`
   requires `heading && summary`, where `summary` is satisfied by *any* of
   `N Flags` / `No flags` / `All checks passed` / `checks failed` / `Checks N/M`.
   On this page the live eval returned `flagsSummary: "NONE"` but
   `checks: "Checks 11/19"` — so the **GitHub CI checks counter** satisfied the
   guard while **no flags panel had rendered at all**. `Checks N/M` is not a
   Devin verdict; it is unrelated CI state.
2. **The page was never authenticated.** Live eval: `signedIn: false`
   (`Connect GitHub` / `Sign in` in the body), and the analysis body ends in
   `26 lines left` — truncated. The auth-wall check deliberately uses a tight
   regex (`sign in to view|log in to access|…`) to avoid false-positives on the
   navbar `Sign in` link, so a page that is merely *logged out and truncated*
   sails past it. The flags panel is gated behind auth, so an empty Flags
   section was the **only possible** outcome — it carries zero bits.

## How to catch it
After exit 0, assert a **positive** flags verdict exists — do not trust the exit
code alone:
```bash
grep -qiE '\b[0-9]+ flags?\b|\bno flags\b' "$OUT/devin-page.txt" || echo "INCONCLUSIVE: no flags verdict"
```
Also check auth + truncation: `Connect GitHub` / `Sign in` present, or
`N lines left` in the analysis, means the scrape is partial.

Secondary trap: `devin-page.txt` is written as a **JSON-encoded single line**
(literal `\n` escapes) when the inline `python3` decode fails — 1 line, 6789 B
here. Every newline-anchored regex in the extractor (including the
`\n\s*\d+\s*Flags?\s*\n` split that builds `## Flags`) then silently matches
nothing, so the Flags section reads clean regardless of content. Decode with
`json.loads` before grepping; a 1-line `devin-page.txt` is itself the tell.

## Fix
Treat "exit 0 + no `N Flags`/`No flags` token" as **inconclusive → DEVIN_SKIPPED**
(best-effort skip), never as a clean Devin pass folded into a verdict. This is the
same class the script's own comments warn about ("never a silent exit-0 clean that
folds a half-rendered page into the verdict") — the guard just misses this variant
because the checks panel satisfies `summary`. Candidate upstream fix: drop the
`All checks passed` / `checks failed` / `Checks N/M` alternatives from `summary`
(they are CI state, not analysis state) and require a flags token, plus reject a
body containing `lines left` while logged out.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786117609038-approver-infra-abstain-devin-fetch-sh-can-exit-0-w.md`_

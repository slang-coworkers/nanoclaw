---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787260895286-uafg6v
written_at: 2026-08-21T22:50:28.706Z
---

# [approver/infra-abstain] Devin's "Analysis is up to date" banner can LIE — verify its finding cards cite files the head diff actually touches

**PR:** shader-slang/slang#12666 @bb8cf4053a7b (reworked head). Decision: ABSTAIN_POLICY / NO_REVIEW_SIGNAL. reason_code is an INFRA code (burns down the infra gate).

## Symptom
On the Devin-only tier (bot-authored fix PR → production review skips it → harvest exit 20 → Devin is the SOLE external review signal), I nearly recorded WOULD_APPROVE: my own source-level challenger was clean and the prior revision's OPEN_GAP was genuinely closed. The OUTPUT_REVIEW critique (codex) caught that Devin's analysis was STALE — bound to a REVERTED intermediate revision, not the head.

## Root cause
The PR had been reworked across 3 pushes. An intermediate revision touched `slang-session.cpp` (a `loadSerializedModuleContents` fallback + a `blobIsStandaloneModuleFile` provenance flag); the FINAL head reverted that and moved the fix to `slang-emit-dependency-file.cpp` (2 files, no `slang-session.cpp`). Devin's structured finding cards still cited `slang-session.cpp:1736/1742-1744/2299-2304` with the reverted revision's signatures ("Duplicate SourceFile", "Blob-provenance flag threaded", "no-dependency-resolved fallback"). Crucially, `devin-commit-status.txt` said `"Analysis is up to date"` and a fresh re-run returned the SAME stale cards under the SAME banner. The banner is not trustworthy — Devin re-scrapes the PR *body* (which describes the head) but its diff-level *findings* lag behind force-pushes/reworks.

## How to catch it (transferable, cheap)
Devin's self-reported freshness (`devin-commit-status.txt`, the "up to date" banner) is NOT sufficient evidence the analysis is head-current. **Cross-check the findings against the head diff's file set:** `gh pr diff <pr> --name-only`, then grep Devin's finding cards for the files they cite. If a card cites a file (or line range) the head diff does NOT touch, the analysis is stale — regardless of the banner. This is a "void evidence returns to UNKNOWN, not to your prior reading" instance: a stale external signal is not a clean signal.

## Fix / procedure rule
- On the Devin-only tier, treat `reviewers_complete=true` as conditional on Devin being provably head-current. If the file-set cross-check fails and a re-run won't re-bind, record ABSTAIN_POLICY / NO_REVIEW_SIGNAL naming the artifact — do NOT let a clean own-challenger read round the decision up (skill: investigation adds caution, never substitutes for a missing review tier).
- This is especially acute on REWORKED PRs (revision chains where an approach was reverted): the reverted-code findings are exactly what a lagging Devin will keep showing. Any revision-chain PR on the Devin-only tier warrants the file-set cross-check before trusting Devin.
- Burn-down note: NO_REVIEW_SIGNAL here is a genuine tooling gap (Devin freshness on reworked PRs), not a policy abstain. The fix that would flip it to a real decision: a head-current Devin re-bind, or a bot review binding to the head. Worth flagging to whoever owns the Devin runner that the "up to date" banner can be wrong after a force-push/rework.

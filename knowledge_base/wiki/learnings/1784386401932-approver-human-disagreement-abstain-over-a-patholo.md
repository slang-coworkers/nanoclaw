---
title: "[approver/human-disagreement] ABSTAIN over a pathological-only false-positive diagnostic; maintainer merged with it — calibrate CHALLENGER_CONCERN severity to real-world trigger likelihood"
type: learning
topic: review-approval
source: learnings/1784386401932-approver-human-disagreement-abstain-over-a-patholo.md
---

# [approver/human-disagreement] ABSTAIN over a pathological-only false-positive diagnostic; maintainer merged with it — calibrate CHALLENGER_CONCERN severity to real-world trigger likelihood

**Symptom:** slang#12147 R5 @74147f95 — I recorded ABSTAIN_POLICY (CHALLENGER_CONCERN) on a verified false-POSITIVE diagnostic: the "simplify" refactor collapsed a deliberate stdout-vs-file `-` distinction, so `-separate-debug-info-output -` plus a coverage-manifest/depfile output that is a **file literally named `-`** compares equal via `_areOutputPathsEquivalent("-","-")` → spurious E00111 collision (slang-end-to-end-request.cpp:776-778 + stdout-normalization :723). The maintainer (jkwak-work) merged the PR **byte-identical to my R5 head** — the concern shipped unaltered → human verdict = APPROVED-equivalent vs my ABSTAIN. Not a false-safe (I did NOT approve a bug), but a miscalibration on the conservative side.

**Root cause:** CHALLENGER_CONCERN severity was driven by "is the finding REAL?" (yes — verified false-positive, bot-missed, CI-invisible) without weighting "how LIKELY is the trigger in real use?" The trigger requires a user to name a real output file literally `-` (a single hyphen) — nearly never happens; `-` overwhelmingly means stdout. The finding is real but the blast radius is ~nil and recoverable (a spurious error, not a crash/miscompile/silent-overwrite). A careful maintainer correctly treats that as a known-benign wart, not a merge blocker.

**How to catch it (calibration rule):** For a CHALLENGER_CONCERN that is a false-POSITIVE (over-rejection) rather than a false-NEGATIVE (missed real bug / silent-overwrite / crash), grade it on TRIGGER LIKELIHOOD × BLAST RADIUS, not just "is it real." A verified-but-pathological-only false-positive (recoverable diagnostic, trigger a user would essentially never hit) is a NIT that clears advisory — it should NOT hold a WOULD_APPROVE when the fix's stated purpose (here: stop the multi-artifact abort) is fully met and no false-negative exists. Reserve ABSTAIN/CHALLENGER_CONCERN for false-positives with a plausible everyday trigger, or any false-NEGATIVE. Contrast the R1–R3 chain on the same PR: those were RED_BUG aborts (crash on valid multi-target input) — correctly BLOCK, and the maintainer fixed exactly that (debugArtifactCount>1 → E00114 diagnostic, :769-773). The BLOCK chain was well-calibrated; the R5 ABSTAIN was over-conservative.

**Fix:** When a challenger clears the "is it real" bar but the trigger is pathological and the failure mode is a recoverable over-rejection, downgrade to advisory nit + WOULD_APPROVE (note the wart), not ABSTAIN. Shadow-mode "never round up" applies to false-NEGATIVES and live changes-requested — it does not require withholding approval over a benign, real-but-unreachable-in-practice false-positive.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784386401932-approver-human-disagreement-abstain-over-a-patholo.md`_

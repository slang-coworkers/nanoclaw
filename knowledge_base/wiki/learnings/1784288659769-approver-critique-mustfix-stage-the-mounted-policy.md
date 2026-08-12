---
title: "[approver/critique-mustfix] stage the MOUNTED policy, not the bundled fallback — and synthesize review-doc BEFORE eval-clauses"
type: learning
topic: review-approval
source: learnings/1784288659769-approver-critique-mustfix-stage-the-mounted-policy.md
---

# [approver/critique-mustfix] stage the MOUNTED policy, not the bundled fallback — and synthesize review-doc BEFORE eval-clauses

**Symptom (two distinct clause-eval failures on #12140 @ a0ef0ec4/f5b280ec, both self-inflicted, not real policy/infra gaps):**

1. eval-clauses.py returned FAIL on `author_trust`, `head_provenance`, `no_protected_paths` for a trusted-author (skiminki-nv CONTRIBUTOR) fork PR touching `cmake/CompilerFlags.cmake` — contradicting the SAME PR's prior CLEAN decision.
2. Later, `commit_match` came back UNEVALUABLE ("review doc absent or carries no commit_id") → would force ABSTAIN_INFRA — despite a head-current harvested review whose commit_id matched the pinned head.

**Root cause:**

1. I copied the skill's **bundled fallback** `APPROVAL_POLICY.json` (policy_version `v0-shadow`, a TIGHTENED default: CONTRIBUTOR untrusted, fork forbidden, `cmake/**` + `**/*.yml` + `external/**` protected, require CI green) into the workspace `policy/` dir. The **authoritative mounted** policy is `/workspace/extra/approver-policy/APPROVAL_POLICY.json` = `v0-shadow-relaxed` (human-signed haaggarwal 2026-07-10; CONTRIBUTOR trusted, fork allowed, protected set only `.github/**` + `**/slang-tag-version.h`). eval-clauses.py's own resolution order is: explicit `--policy` → per-PR staged `policy/` → mounted `/workspace/extra/approver-policy/` → bundled fallback. By staging the bundled file I *shadowed* the mount with the wrong policy. Every recent decision (#799, #12144, prior #12140) ran `v0-shadow-relaxed`.
2. eval-clauses.py derives `commit_match` by reading the `commit_id` from the embedded `_approver_result` JSON in `review/review-doc.md`. I ran the clause script BEFORE synthesizing that doc (workflow Step 1b synthesis must precede skill Step 1) → no doc → UNEVALUABLE.

**How to catch it:** if a clause FAILs/UNEVALUABLEs in a way that contradicts a prior CLEAN on the same PR/author/paths, suspect a data-staging error before trusting the verdict. Check `policy_version` in the emitted clauses.json against `/workspace/extra/approver-policy/APPROVAL_POLICY.json`'s version. A `commit_match` UNEVALUABLE with a valid harvest almost always means review-doc.md wasn't synthesized yet.

**Fix:** (a) Always stage the workspace `policy/` from the MOUNTED authoritative policy (`cp /workspace/extra/approver-policy/APPROVAL_POLICY.json work/<pr>/policy/`), or stage nothing and let eval-clauses.py resolve the mount itself — NEVER copy the skill-bundled fallback. (b) Synthesize `review/review-doc.md` (with the `_approver_result` block carrying commit_id/diff_hash) BEFORE running eval-clauses.py. Codex DECISION_REVIEW independently re-verified the staged policy was byte-identical to the mount — keep asking the challenger/critique to confirm you didn't cherry-pick the lenient policy to force a pass.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784288659769-approver-critique-mustfix-stage-the-mounted-policy.md`_

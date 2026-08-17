---
title: "[approver/critique-mustfix] Do not stage the bundled v0-shadow policy into the workspace policy/ dir — it shadows the mounted v0-shadow-relaxed and flips clauses to FAIL"
type: learning
topic: review-approval
source: learnings/1784117125434-approver-critique-mustfix-do-not-stage-the-bundled.md
---

# [approver/critique-mustfix] Do not stage the bundled v0-shadow policy into the workspace policy/ dir — it shadows the mounted v0-shadow-relaxed and flips clauses to FAIL

**Symptom:** On slang#12118 I copied the bundled `APPROVAL_POLICY.json` (`v0-shadow`, the conservative default next to `eval-clauses.py`) into the per-PR workspace `work/<pr>/policy/` during staging. `eval-clauses.py` then resolved to it (per-PR staged beats mounted) and reported `author_trust`=FAIL (CONTRIBUTOR not trusted) + `head_provenance`=FAIL (fork head), which would have short-circuited to ABSTAIN_POLICY:CLAUSE_FAIL **before** the challenger ran — a false policy abstain.

**Root cause:** `eval-clauses.py` policy resolution order is: `--policy` > per-PR `<ws>/policy/APPROVAL_POLICY.json` > mounted `/workspace/extra/approver-policy/APPROVAL_POLICY.json` > bundled default. The authoritative production policy is the **mounted** `v0-shadow-relaxed` (trusts CONTRIBUTOR/FIRST_TIMER/NONE, `allow_fork_head:true`, `require_ci_green:false`, keeps only `.github/**` + `**/slang-tag-version.h` protected). Staging any per-PR `policy/` silently overrides it with the stricter bundled defaults.

**How to catch it:** After `eval-clauses.py`, read the `policy_version` it printed. If it says `v0-shadow` (not `v0-shadow-relaxed`) you're on the wrong policy. Confirm the mounted file exists: `test -f /workspace/extra/approver-policy/APPROVAL_POLICY.json`.

**Fix:** Do NOT create a `work/<pr>/policy/` dir at all unless you deliberately intend a per-PR override — leave it absent so `eval-clauses.py` falls through to the mounted `v0-shadow-relaxed`. The `/slang-pr-approve` workflow's Step-1a "write tmp/context.json" does NOT ask you to stage policy; the skill reads the mounted one. (I removed the wrongly-staged file, re-ran, and got all 6 clauses passing correctly.)

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784117125434-approver-critique-mustfix-do-not-stage-the-bundled.md`_

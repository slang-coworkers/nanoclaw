---
title: "[approver/human-disagreement] Titular-scope-incompleteness OPEN_GAP on internal dev-tooling tends to be over-cautious — maintainers ship net-positive incremental hygiene fixes"
type: learning
topic: review-approval
source: learnings/1784141883615-approver-human-disagreement-titular-scope-incomple.md
---

# [approver/human-disagreement] Titular-scope-incompleteness OPEN_GAP on internal dev-tooling tends to be over-cautious — maintainers ship net-positive incremental hygiene fixes

**Symptom:** slang#12118 ("compile-perf: read suite files as explicit UTF-8 **everywhere**") — I decided **ABSTAIN_POLICY (OPEN_GAP)** because the mechanical rewrite missed 3 same-class bare `open()` reads (analyze.py:144, report.py:168, sweep.py:43), so the PR didn't literally achieve "everywhere." The maintainer (jvepsalainen-nv) **merged it unchanged** @ my exact decision head `d550c4c2e8da`, reviewDecision=APPROVED — the 3 flagged reads shipped as-is. Over-cautious mismatch (NOT a false-safe: abstain where human approved is the safe direction).

**Root cause of the mismatch:** I graded the gap on "does the diff fully deliver its titular scope?" and leaned ABSTAIN because it undermined the *stated purpose*. But the maintainer graded it on "is this a net improvement that introduces no regression?" — and it plainly is: converting ~26 of ~29 suite reads to explicit UTF-8 is strictly better than the status quo, the 3 remainders are *pre-existing* behavior (not newly broken by this PR), and the whole surface is **internal dev tooling** (`tools/compile-perf/`), not shipped compiler code or user-facing API. An incomplete hygiene improvement of internal tooling is the archetype a maintainer merges and files the remainder as follow-up.

**How to catch / calibrate next time:** For a 🟡 gap of the form "the fix doesn't cover ALL sites of its titular scope," distinguish two cases before leaning ABSTAIN:
- **Incomplete-improvement** (this PR): remaining sites are *same-class pre-existing* behavior the PR simply didn't touch; nothing is newly broken; net strictly-positive; especially in non-shipped code (tools/, tests/, CI helpers). → lean **CLEAR as advisory** (note the residual sites for a follow-up), do NOT abstain on "not literally everywhere."
- **Introduced-regression or load-bearing-hole**: the PR's own new abstraction is bypassed in a way that *reintroduces the exact bug it claims to fix on a path the PR touched/renamed*, or the hole is in shipped/user-facing code. → **ABSTAIN (OPEN_GAP)** stands.
The discriminator: *did the PR make it worse or leave a pre-existing same-class gap?* Leaving a pre-existing gap in internal tooling is not an abstain-worthy defect just because the title says "everywhere."

**Fix:** Weight gap severity by (a) shipped-vs-tooling, (b) introduced-regression-vs-pre-existing-remainder, (c) net-direction. Reserve titular-scope OPEN_GAP for cases where the incompleteness creates a *new* trap or sits in production paths. Note: the abstain still "worked" (a human looked and approved), so this is calibration, not a correctness failure — but repeatedly abstaining on incremental tooling hygiene erodes signal value.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784141883615-approver-human-disagreement-titular-scope-incomple.md`_

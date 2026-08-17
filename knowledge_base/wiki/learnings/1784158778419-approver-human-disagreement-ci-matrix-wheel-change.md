---
title: "[approver/human-disagreement] CI-matrix wheel changes: static '0 bugs' is weak — only running the matrix finds build breaks"
type: learning
topic: review-approval
source: learnings/1784158778419-approver-human-disagreement-ci-matrix-wheel-change.md
---

# [approver/human-disagreement] CI-matrix wheel changes: static "0 bugs" is weak — only running the matrix finds build breaks

**Signal class:** PR changes a CI wheel/build matrix (`.github/workflows/*wheels*.yml`, cibuildwheel config, torch/python version matrices) — adding a Python version, bumping a build toolchain, adding/excluding matrix combos.

**Symptom (slangpy#1002, "add Python 3.14 support"):** Devin's static review reported 0 bugs / 0 flags; my decision was ABSTAIN_POLICY (protected `.github/**` → human must look). The human maintainer (jhelferty-nv) did NOT merge on the clean static read — he **ran the actual `wheels` GitHub Action** first, found **4 failing macOS configurations** (tracked in a new issue #1067), and only then merged (after a second maintainer, jkwak-work, APPROVED). Outcome for my row: merged ⇒ APPROVED-equivalent; ABSTAIN_POLICY was the correct call.

**Root cause / why static review is weak here:** A CI-matrix change's real failure mode is "combo X doesn't build/install on platform Y." That is only observable by *executing* the matrix — a static reviewer (Devin, claude-code-action, CodeRabbit) reading the YAML diff cannot verify a wheel actually builds for cp314 on macOS-arm64. "0 bugs" from a static reviewer on a matrix change means "the YAML looks well-formed," NOT "the wheels build." The two are easily conflated into false confidence.

**How to catch it / apply it:** This is the concrete justification for `.github/**` being a protected path that ABSTAINs to a human — do not treat a clean Devin/bot verdict as grounds to round a wheel/matrix change up. When challenging (if the clause ever lets you reach Step 3 on such a change), the tough question is "has the matrix actually been RUN at this head, or only statically read?" A green `build (...)` check on the PR head that exercises the *changed* matrix rows is real evidence; a clean static review is not. If CI hasn't run the new matrix rows, uncertainty ⇒ ABSTAIN. Confirmed: for CI-matrix/packaging shapes, ABSTAIN_POLICY → human (who runs the workflow) is the safe, correct disposition.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784158778419-approver-human-disagreement-ci-matrix-wheel-change.md`_

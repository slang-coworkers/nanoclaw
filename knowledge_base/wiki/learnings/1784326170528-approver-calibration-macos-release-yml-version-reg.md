---
title: "[approver/calibration] macOS release.yml version-regex fix → ABSTAIN_POLICY on protected path (fix was correct)"
type: learning
topic: review-approval
source: learnings/1784326170528-approver-calibration-macos-release-yml-version-reg.md
---

# [approver/calibration] macOS release.yml version-regex fix → ABSTAIN_POLICY on protected path (fix was correct)

## Symptom
slang#12149 "Fix macOS signing version extraction" (gtong-nv): a single-line, obviously-correct fix to a `sed` version-extraction regex in `.github/workflows/release.yml`. Decision = ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths @ 5e104d738819.

## Root cause / why the abstain is right
The only changed file is `.github/workflows/release.yml`, matching protected globs `.github/**` and `**/*.yml`. `eval-clauses.py` FAILs `no_protected_paths`, which is a terminal ABSTAIN_POLICY that short-circuits before the Step-3 challenger — correct even though the underlying change is a clean, principled fix and CI is green. This confirms the standing calibration from slang#12075 / #12086: `.github/workflows/**` one-liners abstain on protected-path regardless of how safe the diff looks. A human owns release/CI plumbing.

## The fix itself (informational — did NOT change the abstain)
Old: `sed -E 's/.*\.0\.([0-9]+(\.[0-9]+)*)\.dylib$/\1/'` — greedy `.*\.0\.` matches the LAST `.0.`, so `libslang-compiler.0.2026.0.5.dylib` → `5` (verified). New: `sed -E 's/^libslang-compiler\.0\.(...)\.dylib$/\1/'` anchors at the literal prefix → `2026.0.5` (verified). Root-cause fix of a wrong-version-extraction bug.

## CodeRabbit's 🟠 Major flag was pre-existing, not PR-introduced
CodeRabbit (fallback tier; no github-actions[bot] production review; Devin timed out) flagged: on a non-matching basename `sed` echoes input unchanged, so `[[ -z "$version" ]]` passes and downstream builds invalid paths. Verified BOTH old and new regex use `sed -E 's/.../\1/'` (no `-n .../p`), so both echo on non-match — the PR changed only the match pattern. This is a pre-existing robustness gap, not a 🔴 and not introduced here. Even if it were material, the protected-path clause FAIL is terminal, so gap severity never gets evaluated.

## How to catch it / rule
Single-file `.github/workflows/*.yml` change → expect terminal ABSTAIN_POLICY/no_protected_paths before doing any code reasoning. Do the correctness read anyway for the audit trail, but don't let a clean fix or a clean/absent bot review tempt a WOULD_APPROVE — the clause is terminal by design. A bot-flagged "this extraction could break for edge X" that is equally true of the pre-change code is a pre-existing gap, not a PR defect.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784326170528-approver-calibration-macos-release-yml-version-reg.md`_

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787134461033-k6rgp2
written_at: 2026-08-19T10:43:28.045Z
---

# [approver/confirmed-safe] slang-rhi submodule ToT bump — the 4-point control that certifies WOULD_APPROVE

## Symptom / shape
`shader-slang/slang` PR titled "Update slang-rhi to ToT" — a single-file (+1/-1) bump of the `external/slang-rhi` git submodule pin, human-authored by an NVIDIA member. No source/CMake/flag changes. (Instance: #12615 @ e36eb3652caa, 29dc332e→d6d3141, WOULD_APPROVE.)

## Why the normal artifacts don't auto-certify it
- Production Claude review is SKIPPED for a submodule-only diff (no `github-actions[bot]` review check-run exists) — genuine repo-property skip, NOT infra failure. Do NOT record NO_REVIEW_SIGNAL for its absence.
- CodeRabbit SKIPS structurally: `.coderabbit.yaml` excludes `external/**`, so its comment is a "Review skipped due to path filters" notice, not a clean pass. harvest exit 20 → Devin-only fallback tier.
- `external/**` is NOT a protected path under the mounted relaxed policy (protected = `.github/**`, `**/slang-tag-version.h`) → `no_protected_paths` passes; never hand-judge this, run eval-clauses.py and read policy_version.

## The 4-point control that actually carries bits (all cheap, gh read-only)
1. **Pin dereferences to the claimed target.** `gh api repos/shader-slang/slang-rhi/commits/<newpin>` — confirm it resolves and, for "ToT", equals `commits/main` HEAD. Title-accuracy check.
2. **Forward, not rollback/divergent.** `gh api repos/shader-slang/slang-rhi/compare/<oldpin>...<newpin>` → expect `status:"ahead", behind_by:0`. A rollback or off-branch pin shows behind>0 or "diverged".
3. **Integration CI ran and is green on the head — enumerate check-runs DIRECTLY, never the combined /status fold.** The `test-slang-rhi` jobs (macos/windows/linux × debug/release) are the correct one-variable control (old pin→new pin) exercising the actual slang↔slang-rhi boundary. A CLA/CodeRabbit-only combined `success` is vacuous here.
4. **Devin over the head** (head-current signal, the primary reviewer for this tier): 0 bugs/0 flags, and it typically builds slangc+slang-test against the new pin and runs cpu/llvm tests.

## Gotcha that looks scary but isn't
A red `check-pr-label` check-run can be STALE — it fails before the `pr:` label is applied, then the label lands and combined status flips to success. Verify the label is present now + combined status API = success before treating it as a real failure. It is a process check, never a code/test signal.

## Fix / rule
For this shape, WOULD_APPROVE is defensible when 1-4 all hold. Uncertainty on any of them (pin doesn't resolve, behind>0, test-slang-rhi jobs missing/red, Devin failed with no other signal) → ABSTAIN, never round up.

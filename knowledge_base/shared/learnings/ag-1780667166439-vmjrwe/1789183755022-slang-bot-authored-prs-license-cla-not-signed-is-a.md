---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786741961625-fo2c0x
written_at: 2026-09-12T03:29:15.022Z
---

# Slang bot-authored PRs: license/cla not_signed is a SOFT gate (maintainers merge anyway)

On `nv-slang-bot[bot]`-authored PRs to shader-slang/slang, the `license/cla` check shows PENDING / `not_signed` (CLAassistant: "author has not signed"). This looks like a hard merge blocker but is **not** one.

Evidence (confirmed by slang-triager, Sep 2026): 6 nv-slang-bot-authored PRs merged Sep 2–11 2026 (merged by tangent-vector / jvepsalainen-nv / jkwak-work) despite the identical bot authorship and unsigned CLA. Maintainers merge bot PRs regardless of the CLA badge.

Implication for a fixer: **do not spin on the CLA.** A bot identity cannot self-sign a CLA, but that does not block the PR. Report it once as an FYI/soft-gate and move on. The real merge blocker on these PRs is usually `reviewDecision: REVIEW_REQUIRED` with 0 human reviews (a maintainer-attention issue), not the CLA and not CI infra.

Also useful: `test-macos-debug-clang-aarch64 / test-slang` failing on `tests/debuginfo/debug-do-while-locals.slang` with `Assertion failed: (unique_id_ != 0)` (instruction.h:251) is a **known intermittent flaky** — tracked by #13024, quarantined by #13026. A single-config failure whose sibling release/other-OS configs pass is the classic flaky signature; just `gh run rerun --job <id>`, no source change.

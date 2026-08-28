---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787815266995-69qqjf
written_at: 2026-08-27T07:31:41.109Z
---

# Triaging a "test over-specifies" claim: find the exact failing assertion line, then check which sibling assertion passed

When a bot/reporter says a CI failure is "test-only over-specification, no compiler fix needed," verify it structurally rather than accepting or rejecting wholesale — and expect the answer to be BOTH layers at once.

**Method that worked (slang#12788, Win-ARM64 DepfileOutput regression of #12666):**
1. Pull the exact failing line from the CI log, not just the job name: `gh run view --job <id> --log | grep -iE "<test>|<assert-msg>"` gave `unit-test-depfile.cpp:339` + message. That pinpoints WHICH assertion in a multi-assert test fails.
2. Read that test block. The failing assertion (`:339`, folded module `a.slang` SOURCE) was DISTINCT from the sibling assertion (`:341`, the `.slang-module` itself) that PASSED on the failing platform. The passing sibling IS the feature's real contract; the failing one pinned incidental behavior.
3. Trace the producer to decide if the "incidental" behavior SHOULD be deterministic. Here it genuinely is platform-dependent: with both source + binary present, `import` prefers the binary, and whether the module's folded SOURCE re-appears depends on binary-load relative-path re-resolution via `IncludeSystem::findFile` (slang-session.cpp ~2271) — which SILENTLY DROPS a present-on-disk source on failure (no else/diagnostic).

**Key insight — two truths at two layers, don't collapse them:** (a) the test over-specifies (relax it, unblocks CI, matches the guaranteed contract), AND (b) there's a separate latent producer robustness gap (the silent drop). The test fix is correct AND does not MASK (b), because the test never intentionally exercised the failure path and sibling tests still lock the real contract. Recommend the test fix NOW + a SEPARATE low/P3 issue for the producer gap. Do NOT block the CI fix on the deeper gap, and do NOT reject the "test-only" claim just because a deeper bug exists nearby.

**Bisection verification is cheap and decisive:** `gh run view <run> --json conclusion,jobs` on the merge commit vs the immediately-prior merge-group run confirms "genuine post-merge regression" in two calls — do it before labeling `regression`. Do NOT apply `reproduced` for a platform-only failure you can't run locally (Win-ARM64 from a Linux x86_64 container); note the limitation instead.

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788539495823-2zlrcg
written_at: 2026-09-11T18:36:25.364Z
---

# Cross-repo integration CI red on a bot PR is usually version skew, not a code bug

When a required **cross-repo integration** check (e.g. shader-slang/slang's "SlangPy Tests") goes red on a bot-authored PR, check the PR's `mergeState` **first** — a branch that is `BEHIND` master after a *coordinated breaking change* fails the integration build even though both projects' main branches are individually correct.

**Concrete case (2026-09-11):** slang **#12986** (commit `578d571f9e`, merged 2026-09-10, an intended `## Breaking change`) **ADDED** the public `enum MatrixLayoutMode` at `core.meta.slang:2298` and retyped the matrix-layout generic value-param `int`→`MatrixLayoutMode`. slangpy **#1135** (merged 2026-09-11) then started referencing the symbol by name in `staticarray.slang:10`. The `ci-slangpy-trigger-test.yml` workflow builds **the PR's own slang commit** against **slangpy main**. So any slang PR behind #12986 = pre-symbol slang + post-#1135 slangpy → `error[E30015]: undefined identifier 'MatrixLayoutMode'`, hitting a whole cluster of un-rebased bot PRs at once (#12909, #12910, #12912, #12915, #12674, #12818).

**Two traps this case exposed:**
1. The fixer's first CI-triage read — "latest slang no longer exposes MatrixLayoutMode at that scope" — was **inverted**. Latest slang *does* define it (verified `git grep` on the parent commit showed the symbol is NEW, not removed). The failing builds were on OLD slang. Always confirm a "symbol removed" theory with `git log -S <symbol>` / a grep on the parent commit before relaying it — direction matters.
2. The remedy is **rebase/merge master into the branch**, routine PR hygiene — NOT a slang-core change, NOT a slangpy change, and **no issue to file**. Reach for "is this branch behind master?" before "compiler/stdlib bug" whenever a cross-repo integration check is the *only* red and core jobs are green.

Reinforces the standing rule: verify a coworker's root-cause against source before acting on or relaying it. A confident, well-formatted CI diagnosis can still be exactly backwards.

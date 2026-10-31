---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-30T08:39:31.474Z
---

# slang merge-queue evictions with green merge_group CI = slangpy's SlangPy Tests check

When slang PRs are removed from the merge queue with reason `failed_checks` but every slang `merge_group` CI run is green, the failing required check is `SlangPy Tests`. It runs in the **slangpy** repo (`.github/workflows/ci-latest-slang.yml`, event `repository_dispatch`, run name `Slang PR #<n>: <title> (<author>)`), so the slang Actions API does not show it. To diagnose: list `/repos/shader-slang/slangpy/actions/runs?created=>=<W0>` and filter names starting with `Slang PR #`. On 2026-10-29 every such run failed from 22:12Z (Windows MSVC `build-pr`, step `build-and-test-with-slang`; bot diagnosed pyright/nodeenv in slangpy #1250). That blocked all slang merges and caused 4 evictions (#13918, #13855, #14052, #13848). Also: a `falcor-ci` deployment that nobody approves ends the run `failure` after about 30 days (#13328 run 36626805974 created 09-29T20:30Z, ended 10-29T20:39Z), and the PR rollup turns red. Also: Discord h7per's GitHub login is H7perus; `author:h7per` hits a different account (H7PER).

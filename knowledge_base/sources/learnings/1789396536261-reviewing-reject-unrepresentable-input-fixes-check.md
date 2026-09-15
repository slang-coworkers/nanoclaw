---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789394460573-miqxwx
written_at: 2026-09-14T14:35:36.261Z
---

# Reviewing "reject unrepresentable input" fixes: check sibling layout-query sites

When a Slang PR fixes a crash by adding a guard/diagnostic at **one** site that queries `getNaturalSizeAndAlignment` (or any layout/size query that can fail), the highest-value correctness check is to search for **sibling call sites with the same failing query on a related type** that the fix left unguarded — the fix is often incomplete.

Concrete instance: PR #13063 (slangi/HostVM `printf("%s", <runtime String>)` SIGSEGV) added a guard in `ensureWorkingsetMemory` (queries the *instruction's own* type). But `kIROp_Var` (slang-emit-vm.cpp:668) and `kIROp_Store` (:710) query the **pointee** type via `tryGetPointedToType` + `getNaturalSizeAndAlignment` and were left unguarded, so an unrepresentable pointee never materialized as a value (e.g. a literal written through `out String`, or a `struct{ String s; int i; }` where only `i` is used) can still get a silent 0-byte slot with no diagnostic. The PR-cited "analog" safety net `checkUnsupportedInst` does NOT run for HostVM (slang-emit.cpp early-returns ~:1805 before the ~:2882 call), so nothing else catches these. Grade Gap (not Bug) if crash-reachability from the silent 0-byte slot is unverified; ask the author to either factor check-diagnose-reset into one shared helper used at all layout-query sites, or justify unreachability in the Process report.

Reviewer-complementarity note for the 3-reviewer pipeline: this completeness gap was found ONLY by Reviewer A's correctness subagents (code-quality + cross-backend converged). Devin (B) reported clean and clarity (C) only flagged advisory doc/wording items. For "add a guard at the backend boundary" changes, A is the reviewer that catches missing sibling coverage; B/C rarely do.

Ops: `gh auth status` reporting the `GH_TOKEN` as invalid ("token in GH_TOKEN is invalid") is the known App-token quirk — `gh pr view`/`gh pr diff` reads still succeed. Do not treat the auth-status 401 as a blocker for pr-mode reviews.

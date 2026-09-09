---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786435028442-92fixi
written_at: 2026-08-11T08:37:45.551Z
---

# [approver/clause-gap] A refactor that deletes its own property's only test is green by construction

**Symptom.** slangpy#1099 made nanothread a PRIVATE SGL dependency so all clients share one task pool. 12/12 CI build jobs green across linux gcc+clang (x86_64/aarch64), macos-aarch64, windows-msvc, Debug+Release, with `unit-test` + `header-validation` — real tests, not build-only. Every scripted clause passed. The code was verifiably correct. I nearly cleared it.

The diff also **deleted the only test that observed the property the PR exists to establish** (`rhi task pool shares nanothread workers`, which asserted `worker_id != 0`), replacing it with one that only checks a `do_async` callback ran — a strictly weaker assertion that would still pass if pool sharing regressed.

**Root cause / the transferable class.** For a *linkage or signature refactor*, green CI is a strong positive control for compile+link (a shifted positional arg or a leaked header fails to build) — so it feels like real evidence, and it is. But it cannot witness a **runtime topology property** (which pool, which thread, which instance). When the same diff removes the test that did witness it, CI is green *by construction* for that property, and no test fails because none asserts it anymore.

Generalized: **when a PR's stated purpose is a property, check whether the diff also removes the thing that observes that property.** The dangerous pattern is not a missing test — it's a *deleted* test whose mechanism was the API being removed, so deleting it looks like necessary cleanup rather than coverage loss. Both facts are in the same diff, which is why reading the test hunk as "test churn" instead of "coverage delta" misses it.

**How to catch it.** Cheap, mechanical, do it on every refactor:
1. Name the property the PR claims (here: one shared pool).
2. Grep the *pre-image* for tests asserting it. Grep the *post-image* for the same.
3. If the count went to zero, that's an OPEN_GAP regardless of how green CI is and regardless of whether the new code is correct today.
4. Ask what regression class is now uncaught, in one sentence. If you can name it ("rhi tasks stop using the shared pool"), it's a gap.

Corollary on the positive-control probe: record *what* the control covers, not just that one exists. "12/12 green" is a positive control for compile/link and a **vacuous** one for pool sharing. Writing the scope next to the claim is what separates the two.

**Fix.** ABSTAIN_POLICY / OPEN_GAP — not a claim the code is wrong (it was verified correct at that commit), but a claim that auto-approving is unwarranted when the regression guard for the central property was removed. Extra weight on the **fallback tier** (production review skipped, only CodeRabbit + Devin): policy says uncertainty abstains there and never rounds up. A human maintainer resolves it in ~2 minutes — "linkage covers it" vs "add the test" — and that judgment is theirs.

Related shape worth probing on the same class of PR: the change added 8 newly exported wrappers and tested 2. New public API surface + net-reduced behavioral coverage in one diff is itself a signal.

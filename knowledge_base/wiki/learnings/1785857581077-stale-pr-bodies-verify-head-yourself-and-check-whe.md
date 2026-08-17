---
title: "Stale PR bodies: verify head yourself, and check whether a 'removed guard' claim is partly true"
type: learning
topic: verification
source: learnings/1785857581077-stale-pr-bodies-verify-head-yourself-and-check-whe.md
---

# Stale PR bodies: verify head yourself, and check whether a "removed guard" claim is partly true

When told a PR description has gone stale, re-derive every claim from the source at head instead of transcribing the handoff — even a careful handoff can miss a nuance that changes the correction.

Case: slangpy#1078. The body claimed Metal skip guards were "removed from" three tests because slang#7606 closed. Head did the opposite — guards retained, extended to four new tests, plus new d3d12 skips, all retargeted to the *open* slangpy#1079. The handoff framed this as 0/3 true. Reading `git show <head>:slangpy/tests/slangpy_tests/test_array.py` showed it was **1/3 true**: `test_vectorize_struct_with_resource_array` genuinely has no guard at head and does pass on Metal. Saying "only this one was actually removed" is more useful to a maintainer than a flat "the claim was wrong."

Practical notes:
- Get real numbers rather than restating a stale count. CI logs are per-job verbose (`[gwN] [pct] STATUS <nodeid>[DeviceType.X]`), so per-test/per-backend status is directly readable. Delegate the log extraction to a subagent — the logs are huge.
- Only jobs whose matrix entry carries the `unit-test` flag run pytest; build-only jobs contain zero pytest output *by design*. Don't read that silence as truncation or as missing coverage.
- A stale figure can still be arithmetically correct at head. "36 passed, 2 skipped" survived three commits because the new guards only fire on metal/d3d12 while the figure came from a Linux (vulkan+cuda) run: 19 tests × 2 backends − 2 module-level skips = 36. Check before calling a number wrong.
- Keep the *historical* issue reference in the rewrite. Naming the now-closed issue is what explains the retarget; deleting it loses the reason the guards moved.
- Before asserting a sibling PR "fixes" something, fetch its state. `gh pr view <n> --json state,isDraft,body` turns an unverifiable "fix in progress" into a precise "open draft candidate fix, stacked on this one" — a reviewer flagged the vague wording twice and the fix was to add evidence, not to delete the reference.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785857581077-stale-pr-bodies-verify-head-yourself-and-check-whe.md`_

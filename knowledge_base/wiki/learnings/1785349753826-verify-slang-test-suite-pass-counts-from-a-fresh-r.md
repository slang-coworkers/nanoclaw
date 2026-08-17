---
title: "Verify slang-test suite pass-counts from a fresh run, not from a build subagent's number"
type: learning
topic: slang-compiler
source: learnings/1785349753826-verify-slang-test-suite-pass-counts-from-a-fresh-r.md
---

# Verify slang-test suite pass-counts from a fresh run, not from a build subagent's number

A build/verify subagent reported `tests/language-feature/defer/` as "39/39"; the real count from a fresh `slang-test tests/language-feature/defer/` run is **38/38** (13 dx11 variants ignored). The codex OUTPUT_REVIEW re-ran the suite and caught the discrepancy before it shipped in the PR body.

Takeaway: numeric pass/fail counts that go into a PR description or report are load-bearing facts — re-run the suite yourself (or have the reviewer confirm) rather than transcribing a subagent's summary. Subagents can miscount, batch across retries, or include/exclude ignored tests inconsistently. Cheap to verify, embarrassing to get wrong in a public PR body.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785349753826-verify-slang-test-suite-pass-counts-from-a-fresh-r.md`_

---
title: "slang-test -xslang prefix; hook-refused compound commands silently drop side effects; critique verdicts record only on fresh STAGE calls"
type: learning
topic: review-approval
source: learnings/1795199396295-slang-test-xslang-prefix-hook-refused-compound-com.md
---

# slang-test -xslang prefix; hook-refused compound commands silently drop side effects; critique verdicts record only on fresh STAGE calls

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795194329763-s2f605
written_at: 2026-11-20T18:29:56.295Z
---

# slang-test -xslang prefix; hook-refused compound commands silently drop side effects; critique verdicts record only on fresh STAGE calls

Two gotchas hit on slang#14129 (2026-11-20):

1. `-xslang` is a RENDER-TEST option prefix (options.cpp), not slang-test's. `//TEST:SIMPLE(filecheck=...)` spawns slangc directly, which rejects `-xslang` with E00017 → the test "fails" with result code 1 and the filecheck miss is on the command-line error, not the IR. For SIMPLE/other direct-slangc directives, pass the pass-through flag plainly (e.g. `-experimental-feature`); check slang-test's failure output for `result code = N` — N≠0 means the COMPILER failed, and only then look at filecheck misses. A test that "fails as expected" can be failing for the wrong reason.

2. A PreToolUse hook refusal (e.g. gate-pr-description's "write the file in an earlier step") aborts the WHOLE bash call — including side effects that had already run in your mental model. My `printf ... >> PR_BODY.md && gh pr edit ...` was refused, and my retry ran only `gh pr edit`, so the append silently never happened; the PR body stayed disclaimer-less until an OUTPUT_REVIEW caught it. After any hook refusal, re-verify the file side effect separately before re-running the gated command.

Also: the critique tracker records a stage's verdict only from a FRESH mcp__codex__codex call carrying `STAGE:` — codex-reply rounds approve but are not recorded, and any file edit after a fresh approve re-arms the gate ("N edits since the last critique round"). Plan for one fresh call per stage per state, not reply rounds.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1795199396295-slang-test-xslang-prefix-hook-refused-compound-com.md`_

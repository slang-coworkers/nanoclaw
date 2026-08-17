---
title: "slang-pr-review: scope a re-run to focused verification when the re-push is test-only"
type: learning
topic: slang-compiler
source: learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md
---

# slang-pr-review: scope a re-run to focused verification when the re-push is test-only

The /slang-pr-review workflow dispatches three full reviewers (A correctness ~$25/~70min/5 subagents, B Devin, C clarity). That's right for a code change, but disproportionate when a fixer re-pushes a **test-only** delta to close gaps the reviewers themselves flagged.

**How to decide:** before re-dispatching, run `gh api repos/<owner>/<repo>/compare/<prev-head>...<new-head> --jq '.files[].filename'` (or `gh pr diff --name-only` against the prior reviewed head). If the delta touches only `tests/**` (no `source/**`, no `prelude/**`, no `include/**`), the prior round's code verdict still stands — the C++ didn't change. Re-running A on unchanged C++ mostly re-derives the same verdict and re-incurs the subagent-hallucination risk (in one round A's "code quality" subagent invented types/opcodes that don't exist and had to drop all 7 of its findings after re-verifying against the real diff).

**Instead:** fetch the changed test files at the new ref (`gh api repos/<owner>/<repo>/compare/<a>...<b> --jq '.files[]|select(.filename|test("...")) |.patch'`) and verify the test LOGIC directly — does the new CHECK encoding actually catch the regression class the reviewers flagged? That's the reviewer's job anyway, it's seconds not an hour, and it's higher signal than a full pipeline pass. Report transparently that you scoped to focused verification and offer the full run if they want it.

**FileCheck nuance worth reusing** (Slang diagnostic tests): to make a multi-case negative test actually pin each case, the right tool depends on the diagnostic's scope. A **per-entry-point** availability error (e.g. E36107) can be isolated by splitting into separate entry points each referencing only one construct, with per-entry filecheck prefixes (RES/SAMP). A **module-wide semantic** error (e.g. E30019 type-mismatch) is reported regardless of entry point, so a per-entry split does NOT isolate cases — use **ordered** (non-DAG) `CHECK:` lines, each pinning a distinct `expected '<type>', got '<got>'` pair; forward-only ordered matching then fails if any one case stops erroring. Un-anchored `CHECK-DAG: <code>` is the anti-pattern — a subset of cases can satisfy all DAG lines, so a single-case regression passes silently. Also: a comment containing a literal `CHECK:`/`CHECK-DAG:` token is parsed by FileCheck as a real directive — reword such comments.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md`_

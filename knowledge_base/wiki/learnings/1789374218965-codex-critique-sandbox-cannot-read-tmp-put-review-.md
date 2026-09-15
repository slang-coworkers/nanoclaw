---
title: "codex-critique sandbox cannot read /tmp — put review artifacts under /workspace/agent"
type: learning
topic: agent-ops
source: learnings/1789374218965-codex-critique-sandbox-cannot-read-tmp-put-review-.md
---

# codex-critique sandbox cannot read /tmp — put review artifacts under /workspace/agent

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789373018660-tolbfm
written_at: 2026-09-14T08:23:38.965Z
---

# codex-critique sandbox cannot read /tmp — put review artifacts under /workspace/agent

When invoking `/codex-critique` (mcp__codex__codex), codex runs in a SEPARATE process/sandbox. `/workspace/agent` (incl. git worktrees under it) IS shared and readable by codex, but `/tmp` is NOT. If you write a PR-body or deliverable to `/tmp/foo.md` and point codex's OUTPUT_REVIEW at it, codex returns `must-fix: file does not exist` and you burn a critique round recreating it. Always stage artifacts codex must read (PR body, plan, reports) under `/workspace/agent/...` (e.g. `/workspace/agent/reports/pr_body_<n>.md`) before the critique.

Bonus, verifying an include-hygiene fix cheaply without a full build or compile_commands.json: build an isolated minimal TU that includes ONLY the std headers under review plus the exact failing usage lines, and `-fsyntax-only` it with both g++ and clang++. This proves which include is load-bearing. Concretely for slangpy#1153: with only `<regex>/<iostream>/<fstream>`, both g++12.2 and clang++14 fail on `std::istream_iterator` (not a member of std) — so `<iterator>` is genuinely required and the symbol only reaches the real TU via project headers.

Also note the risk asymmetry: the "a green Linux build doesn't prove portability" discipline targets include *removal* (Linux's transitive path masks a break a strict toolchain will hit). Adding a standard header is the opposite — idempotent and one-sided-safe: it cannot break a TU that already compiles, so a missing full local build is non-blocking for include-*addition* PRs (CI/Devin are authoritative).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789374218965-codex-critique-sandbox-cannot-read-tmp-put-review-.md`_

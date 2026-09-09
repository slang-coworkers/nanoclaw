---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1788203681671-292ccx
written_at: 2026-08-31T19:34:58.899Z
---

# slangpy LeakSanitizer has never been green (17 nights) — don't confuse with slang's clean sanitizer gate

A "leak-gate failing N consecutive nights" report should be checked against BOTH shader-slang/slang and shader-slang/slangpy before escalating — they have separate sanitizer workflows and very different health. As of 2026-08-31: shader-slang/slang's nightly `ci-slang-sanitizer`/LeakSanitizer runs are 15+/15+ green (2026-08-17→08-31, no regression). shader-slang/slangpy's scheduled `sanitizers.yml` (linux `asan-ubsan` leg, "Check LeakSanitizer Reports" step) has FAILED EVERY SINGLE scheduled run since the workflow was introduced by PR #1107 on 08-15 — 17/17 consecutive failures through 08-31, across 6 distinct main SHAs, so it's deterministic (reproduces across code changes), not a flake.

It's already tracked: shader-slang/slangpy#1130 (opened 2026-08-31 08:25Z by an automated coworker, assigned jkiviluoto-nv, labeled bug/CI). Root cause: a real `sgl::ref` ownership-cycle leak in `NativeBoundCallRuntime`/reflection caches, a continuation of #1113's Layout⇄Type/Function lifetime work — not a benign shutdown artifact, and a fix exists but is explicitly being held for maintainer coordination rather than landed unilaterally. Only 1 comment on the issue (the triaging bot itself) — zero human engagement despite the assignee being set. If you see a stale-sounding "N consecutive nights" count for this, recompute from `actions/workflows/{id}/runs?event=schedule` rather than trusting the reported number — an earlier hand-off cited "11th night" when the true count that same day was 17.

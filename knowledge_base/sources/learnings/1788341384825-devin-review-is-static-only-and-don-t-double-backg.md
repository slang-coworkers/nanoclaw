---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788340184260-cawq4t
written_at: 2026-09-02T09:29:44.825Z
---

# Devin Review is static-only; and don't double-background reviewer dispatch

Two things confirmed while running /slang-pr-review on shader-slang/slang#12879 (aarch64-only uninitialized-read miscompile):

1. **Reviewer B (Devin) is static-analysis-only — it never builds or runs code.** For an architecture-dependent runtime bug (e.g. an aarch64-only `0 0` vs `-9 -6` miscompile) Devin cannot provide the runtime oracle. It reconstructs/endorses the PR's reasoning and reports bugs/flags, but the "does the fix flip the output on aarch64?" question stays deferred to the PR's own aarch64 CI legs. Do NOT tell a fixer that Devin can settle a runtime flip; report plainly that it can't and that CI is the only oracle.

2. **Dispatch gotcha:** in the /slang-pr-review dispatch step, launching each reviewer with Bash `run_in_background=true` AND `nohup … &` inside the command double-backgrounds it — the launcher shell exits immediately (you get a spurious "completed exit 0" for the wrapper) while the real reviewer process is orphaned via nohup, so you never get its true completion notification. Fix: either use `run_in_background=true` with a plain foreground command (no `nohup &`), OR (recovery) arm a `Monitor` with an until-loop that `kill -0 <pid>`-polls the detached PIDs and emits one event as each exits + an ALL_DONE line. The PID-wait monitor worked cleanly here.

Also reusable: under the project's C++20 build, adding a default member initializer to a plain struct (`PathInfo::type = Type::Unknown`) keeps it an aggregate, so existing `T{...}` brace-init factories still compile unchanged — a safe, non-ABI, non-breaking fix pattern for uninitialized-scalar-member bugs.

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787174188664-s26e8g
written_at: 2026-08-21T18:33:16.578Z
---

# Stall remedy: distinguish hung build from repeatedly-killed background build before authorizing a clear-and-rebuild

**Rule:** Before authorizing a *destructive* stall remedy ("clear the build dir, kick a fresh clean build"), require the root cause to be distinguished: is the build process **actually hung**, or is it a **background build repeatedly killed by container teardown**? These two present *identically* — no PR, long wall-clock elapsed, last signal a mid-build progress line — but their remedies are **opposite**.

**Concrete instance (shader-slang/slang#12635, 2026-08-21):** The fixer's build showed as "~16h in-flight" with the last signal at build step 198/957. I (Main) pre-authorized the triager to have the fixer abandon the hung build and kick a fresh clean build. The fixer **correctly declined**: the "16h" was three separate container teardowns each killing the *background* `run_in_background` build, not one hung process. The build was genuinely progressing every run (ninja resumes from cache). Clearing the dir would have **discarded cached progress and prolonged the stall**. The right workaround was to keep the container alive by running the build in consecutive ~9.5-min **foreground** chunks within one active turn.

**Why it matters:** The stall *signature* (no output, long elapsed, stuck mid-build) is ambiguous between "process hung" (remedy: kill + restart, possibly clean) and "process keeps getting killed by infra" (remedy: keep it alive; a clean rebuild is actively harmful — it throws away recoverable cache). A pre-authorized destructive remedy issued on the wrong diagnosis can make a *recoverable* stall worse.

**How to apply:** When a build "stall" is reported (long elapsed, no artifact), do NOT default to "clear and rebuild." First ask the owner: is the build process still alive, or is something killing it (container teardown, OOM, --rm on exit)? If it's being killed → non-destructive fix (foreground chunks / keep-alive), never clear the cache. Only authorize a clean rebuild once you've confirmed the process itself is genuinely hung, not repeatedly evicted. Relatedly: `run_in_background=True` for builds is fragile — an approval-triggered rebuild or container teardown silently kills it (see NanoClaw build guidance).

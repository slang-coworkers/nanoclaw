---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889413554-7vxiwt
written_at: 2026-11-20T16:24:05.301Z
---

# pgrep self-match and silent nohup failures fake a running build

When checking whether a background build is running with `pgrep -f "cmake --build"`, the bash tool's own wrapper command can self-match (pgrep sees its own invoking command line) and report a phantom "STILL_BUILDING". Use `pgrep -x ninja` / `pgrep -x cmake` (exact process-name match) instead, or check the log file's existence and tail. Related trap: `nohup bash -c '... > /tmp/opencode/x.log'` where /tmp/opencode is NOT writable (root-owned, mkdir denied) dies instantly and silently — the failed redirect aborts the first command but bash continues to the next, so a multi-command nohup can half-run with no log anywhere. Put background job logs under /workspace/agent/scratch/ and verify the log file appears within seconds of launch. Cost: ~4 minutes of false "build in progress" on 2026-11-20 (#13871 re-verify), and the same bug silently skipped a needed rebuild on 2026-11-17.

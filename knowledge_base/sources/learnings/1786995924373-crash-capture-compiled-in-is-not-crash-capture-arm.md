---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1784740376661-k7feww
written_at: 2026-08-17T19:45:24.373Z
---

# Crash-capture compiled-in is not crash-capture armed (slangpy sgl_tests)

In slangpy CI, the C++ `sgl_tests` binary is *built* with crashpad (`tools/ci.py:134-135` sets `-DSGL_ENABLE_CRASHPAD=ON` when the `crashpad` matrix flag is present — every nvrgfx row has it) and there's an "Upload Crashpad Reports" step archiving `.crashpad/reports/` (`.github/workflows/ci.yml:227-234`). That combination *looks* like teardown crashes would produce minidumps.

They don't. The handler is only **armed at runtime** on the Python side — `crashpad.start_handler()` runs in the pytest session hook (`slangpy/testing/plugin.py:58-59`). The C++ `main()` in `tests/sgl/sgl_tests.cpp:33-65` never calls `start_handler()` and installs no `set_terminate`/signal handler. So the post-`run()` teardown flake (#1062) writes **no minidump**; the uploaded `.crashpad/reports/` is empty for that failure, and the log is just the green doctest summary + a bare `exit 1`.

**Rule:** "instrumentation is compiled in" and "an upload step exists" are two separate facts from "the handler is armed on this code path." An empty capture-artifact reads like "no crash happened" but can equally mean "capture was never armed here." Before citing existing logs as diagnostic (or as an all-clear), confirm the handler is actually *started* on the path that failed — same trap as [[a-zero-needs-a-positive-control]] and [[no-signal-needs-a-trial-count]]: a dead/unarmed path returns exactly the silence you'd hope for.

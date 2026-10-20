---
title: "SlangPy: testing wheel-layout DLL lookup from a dev build on Windows"
type: learning
topic: slang-compiler
source: learnings/1792421035177-slangpy-testing-wheel-layout-dll-lookup-from-a-dev.md
---

# SlangPy: testing wheel-layout DLL lookup from a dev build on Windows

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792161436403-nmk1fh
written_at: 2026-10-19T14:43:55.177Z
---

# SlangPy: testing wheel-layout DLL lookup from a dev build on Windows

On a dev build, two things hide bare-name DLL search bugs that only show up in an installed wheel: `slangpy/__init__.py` calls `os.add_dll_directory(build_dir)`, and `tools/ci.py get_python_env` adds Slang's `bin` folder to PATH. To test what a wheel does, use the pattern from slangpy PR #1233: in a subprocess, wrap `os.add_dll_directory` so it records the cookies it returns, then `import slangpy`, then `cookie.close()` each one. Also remove from PATH every entry that contains the DLL. This reproduces wheel behaviour without building a wheel.
Also for fork PRs: workflow runs with conclusion `action_required` mean CI has NOT run, because the runs are waiting for a maintainer to approve them. A green combined status from license/cla plus CodeRabbit is not a CI pass.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792421035177-slangpy-testing-wheel-layout-dll-lookup-from-a-dev.md`_

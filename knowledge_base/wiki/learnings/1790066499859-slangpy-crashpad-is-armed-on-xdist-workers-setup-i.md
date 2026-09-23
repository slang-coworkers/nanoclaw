---
title: "SlangPy crashpad IS armed on xdist workers — setup() is only DB cleanup"
type: learning
topic: slang-compiler
source: learnings/1790066499859-slangpy-crashpad-is-armed-on-xdist-workers-setup-i.md
---

# SlangPy crashpad IS armed on xdist workers — setup() is only DB cleanup

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790066143620-aji9sm
written_at: 2026-09-22T08:41:39.859Z
---

# SlangPy crashpad IS armed on xdist workers — setup() is only DB cleanup

When triaging a native pytest-xdist **worker** crash in SlangPy where no crashpad minidump was captured, do NOT conclude "crashpad isn't armed on workers." Verified from source (`slangpy/testing/`):

- `crashpad.setup()` (called controller-only in `pytest_configure`, guarded by `if not os.environ.get("PYTEST_XDIST_WORKER")`, `plugin.py:43-44`) does **only** `shutil.rmtree(.crashpad)` — it wipes the shared DB dir; it does NOT arm any handler (`crashpad.py:38-40`). The guard exists so workers don't wipe the shared DB, not to skip arming.
- The actual arming is `crashpad.start_handler()` in `pytest_sessionstart` (`plugin.py:59` → `crashpad.py:80-85`), which has **no** worker guard and runs in every xdist worker.
- `notify_current_test()` writes a per-**pid**→test-name file in every process (`plugin.py:83`) and `report()` (run in the controller's `pytest_terminal_summary`) correlates dumps to tests by pid (`crashpad.py:62-72`). This pid-correlation design is only meaningful if worker crashes are expected to produce dumps — clinching proof that workers are armed.

Therefore, a missing minidump + missing traceback + "worker simply goes down" points to an **uncatchable termination** (GPU-hang watchdog / OOM `SIGKILL`) that crashpad's in-process handler cannot intercept — no code change captures it. To get a backtrace you must re-run without xdist (`-n0`/`-p no:xdist`) so the crash lands where a core can dump, or enable OS core dumps on the runner. (Context: slangpy#1181.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790066499859-slangpy-crashpad-is-armed-on-xdist-workers-setup-i.md`_

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-10-05T22:21:23.748Z
---

# After merging master that bumps the IR module version, do a FULL slang build — targeted slangc/slang-test leaves stale std modules

After `git merge origin/master`, I rebuilt only `--target slangc slang-test`. The full slang-test run then showed 60 failures across functional/ and numerics/, with `warning[E00131]: ignoring IR module version 32 because this compiler supports IR module versions 33 through 33` and `cannot open file 'slang/functional.slang'`. Master had bumped the serialized IR module version, and the targeted build doesn't regenerate the serialized standard modules. A full `cmake --build --preset debug` fixed all 59 of them; the one remaining failure, gfx-smoke (cpu), also fails on master. Rule: after any master merge, build the full preset before running the suite. A sudden jump of dozens of failures in standard-module tests means stale modules, not a regression.

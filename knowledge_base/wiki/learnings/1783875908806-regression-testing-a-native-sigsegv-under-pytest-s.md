---
title: "Regression-testing a native SIGSEGV under pytest (subprocess + strict xfail + phase bracket)"
type: learning
topic: misc
source: learnings/1783875908806-regression-testing-a-native-sigsegv-under-pytest-s.md
---

# Regression-testing a native SIGSEGV under pytest (subprocess + strict xfail + phase bracket)

When a SlangPy/GPU bug is a hard native crash (SIGSEGV, exit 139 — no Python traceback), a plain in-process `@pytest.mark.xfail` does NOT work: the crash kills the whole pytest worker and, under `pytest-xdist`, disrupts the run. Pattern that does work (used for slangpy#1051 / slang#12070, `test_diff_loop_runtime_start.py`):

1. Run the crashing call in an ISOLATED SUBPROCESS (`subprocess.run([sys.executable, __file__, ...])`; the test file doubles as the worker via `if __name__ == "__main__": os._exit(_child_main(sys.argv))`). `os._exit` avoids interpreter/device teardown perturbing the exit code. Precedent: `slangpy/tests/.../test_precompiled_modules.py`.
2. Parent asserts on the child's returncode. A signal death shows as a NEGATIVE returncode (`-signal.SIGSEGV == -11`), NOT shell-style 139.
3. TARGETED xfail: `@pytest.mark.xfail(raises=_KnownCrash, strict=True)`. Parent raises `_KnownCrash` ONLY for the expected crash; wrong-result / infra / clean-exit all surface normally. strict=True makes a clean exit (fix landed) an XPASS = hard failure that forces marker removal.
4. Bound the crash to the exact operation: child prints+FLUSHES `PHASE:begin` immediately before and `PHASE:end` immediately after the crashing call. Parent treats it as the known crash only if begin-seen AND end-not-seen — so a crash in setup/readback/teardown is surfaced, not masked. (stdout survives the crash because of `flush=True`.)
5. Independent oracle for the "fixed but wrong" case: compute expected gradients in numpy (don't compare against another GPU run — circular). Use a NON-SQUARE shape so row/col axis bugs can't hide, and pick params where edges differ from interior (clamp footprint) so the oracle is non-trivial.
6. Gate to POSIX (`os.name != "posix"` -> skip): signal-return-code detection doesn't cover Windows NTSTATUS access-violation codes.

Also: a SIGSEGV discards block-buffered stdout — capture generated shaders with `python -u` (or flush) or `SLANGPY_PRINT_GENERATED_SHADERS=1` output is lost.

Non-obvious diagnosis correction worth remembering: the #1051 trigger was a RUNTIME (non-constant) loop induction start, NOT "negative" — a constant `-2` start differentiates fine; `-radius` was incidentally runtime+negative. Always verify a "negative X" framing by testing a constant negative separately.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783875908806-regression-testing-a-native-sigsegv-under-pytest-s.md`_

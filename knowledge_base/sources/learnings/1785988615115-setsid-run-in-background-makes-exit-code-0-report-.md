# setsid + run_in_background makes "exit code 0" report the WRAPPER, not your build — and a half-linked tree looks like a broken build

Detaching a long build with `setsid nohup cmake --build ... &` and then trusting the harness's
"Background command completed (exit code 0)" notification is a trap: the notification describes the
shell wrapper exiting immediately, **not** the compiler finishing. The build is still running.

Concrete case (shader-slang/slang#12371, 2026-08-06): I fired two detached builds after a
foreground one timed out at 10 min. Both reported "completed, exit code 0". I then checked
freshness properly and got a genuinely alarming picture:
- `slang-emit.cpp.o` mtime 03:43:34Z (recompiled)
- `libslang-compiler.so` mtime 01:09:12Z (**older than its own input**)
- behavioural probe for the just-merged PR's new diagnostic string in the built library: **0 hits**

That reads exactly like "the link step silently didn't run". It wasn't: `pgrep -af ninja` showed
**both builds still live** (and, worse, two `cmake --build` invocations racing in one ninja dir).
Ten minutes later the `.so` relinked at 03:54:41Z and the probe returned 1.

Rules:
- `setsid`/`&` + a completion notification = the *launcher* exited. Verify with
  `pgrep -f 'ninja -f build-*.ninja'`, or arm a monitor that waits on the real process
  (`until ! pgrep -f ninja; do sleep 20; done`), not on an exit code.
- **A stale-looking artifact mid-build is indistinguishable from a failed build.** Before concluding
  "the link didn't run", check whether a builder is still alive. Both my readings were *correct*
  and my conclusion was wrong.
- Don't launch a second `cmake --build` while the first is alive — they share the ninja directory.
- The freshness check that actually works is **behavioural**: grep the built binary/library for a
  string introduced by the commit you expect it to contain. Timestamps alone can't distinguish
  "not built yet" from "built without your change" — and `-v`/version strings are configure-time.
- Corollary for measurement hygiene: after a dependency merges, **rebuild inputs too**. My staged
  `.slang-module` files were produced by the pre-merge binary; reusing them would have made a
  "merged master" run a mixed-binary measurement.

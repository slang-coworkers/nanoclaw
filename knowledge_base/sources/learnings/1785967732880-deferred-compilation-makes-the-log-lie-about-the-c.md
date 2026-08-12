# Deferred compilation makes the log lie about the crash phase — force eager before localizing

Localizing a segfault in slangpy (issue #820: calling a `[shader("compute")]`-tagged entry point through the functional API). I first published "the crash is at dispatch, after compile." **Wrong — it faults in target codegen at pipeline creation.**

**The trap.** `defer_target_compilation` **defaults to `True`** (`slangpy/core/calldata.py:513-514`). With deferral on, the debug log prints `Dispatching …` *before* the deferred compile faults. I read that log ordering as a program counter. Both modes exit rc=139; only the traceback differs, so the crash itself gives you no hint that you're mislocalized.

**The fix — two lines of setup:**
```python
mod = spy.Module.load_from_source(dev, name, SRC,
                                  options={"defer_target_compilation": False})
import faulthandler; faulthandler.enable()
```
Eager mode then names the fault site exactly:
```
calldata.py:524 in _try_build_shader   <- device.create_compute_pipeline(...)
calldata.py:318 in build
function.py:362 in generate_call_data
```
Deferred mode gives only a bare frame at the call site. **`faulthandler` gets you a Python-level stack across a native segfault with no debugger and no local build** — worth reaching for on any nanobind-extension crash.

**Generalization:** a log line is a *proxy* for control flow, and lazy/deferred evaluation is exactly where the proxy detaches from the thing. Before localizing any fault on a path with deferred or cached work, force the work eager. Otherwise you're timing when a message was printed, not when code ran.

**Two adjacent lessons from the same correction:**

1. **Test the arm you listed as a caveat.** My first report noted the `[CUDAKernel]`-tagged variant as untested. Testing it: `[CUDAKernel]` + `[numthreads]` → **rc=0 OK**, while `[shader("compute")]` + `[numthreads]` → **rc=-11 SIGSEGV**, identical body and signature, same loop, controls passing. So the trigger is `[shader("compute")]` specifically, not "already an entry point" generally — which changed the scope of the finding. An untested arm named in a caveat is a cheap experiment you already know you need.

2. **A retraction posted on one issue does not reach the siblings carrying the same claim.** I corrected this localization on the parent epic and left the wrong version live on the child issue — which was the one with the *live assignee*, and the one that said where to look. When you retract a claim about a shared artifact, enumerate every place you published it. Correcting the wrong copy's neighbour is not correcting it.

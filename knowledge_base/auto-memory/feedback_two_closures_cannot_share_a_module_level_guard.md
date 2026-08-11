---
name: feedback_two_closures_cannot_share_a_module_level_guard
description: "Extracting a function into TWO new Function() closures gives each its own copy of the module-level state the function's guard depends on — so a working generation/ticket guard reads as a total no-op. Identical base-vs-head output is the tell."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 21945e3e-4bd9-4aaf-bbbd-9c31680be940
---

# A harness that extracts a function twice cannot see a module-level guard

**2026-08-10, nanoclaw#1182.** Reviewing a fix that stops concurrent `loadFunnel()` runs
from duplicating dashboard panels. The mechanism is a module-level ticket:

```js
let funnelRenderSeq = 0;                       // module scope
async function loadFunnel() {
  const myGen = ++funnelRenderSeq;
  const stale = () => myGen !== funnelRenderSeq;
  ...
}
```

To probe it I extracted the **shipped** `loadFunnel` from `app.js` (the same brace-walk the
repo's own `unit-cost-panel.test.ts` uses) and built two runs so I could interleave them:

```js
const runA = new Function(...stubs, `${src}; return loadFunnel;`)(...);
const runB = new Function(...stubs, `${src}; return loadFunnel;`)(...);   // ← second copy
```

Base and head both printed `UNITCOST=2`. I was one keystroke from publishing *"the guard is
a no-op"* against a fix that works.

**Why:** each `new Function` call evaluates `src` in its **own** scope, so `runA` and `runB`
got **separate `funnelRenderSeq` variables**. `++` in A could never be observed by B. The
guard was structurally unable to fire in my instrument — I had deleted the sharing that IS
the mechanism.

The fix is to put the shared state outside and the function inside a factory, so one counter
serves both runs while each keeps its own identifiable `fetch`:

```js
const src = `let funnelRenderSeq = 0;
             function makeRun(fetch) { ${body}; return loadFunnel; }
             return makeRun;`;
const makeRun = new Function(...stubs, src)(...);
const runA = makeRun(mkFetch('A'));
const runB = makeRun(mkFetch('B'));    // shares funnelRenderSeq
```

With that, base `["RQ","UNITCOST","KB","UNITCOST"]` vs head `["RQ","KB","UNITCOST"]` — the
fix is real, and the same harness then found a genuine gap (one unguarded `innerHTML` write).

⭐⭐⭐ **"I extracted the SHIPPED function" is not enough when the state the function depends
on lives OUTSIDE it.** The extraction boundary must enclose the state, not just the code.
Applies to any module-level singleton a function reads: generation counters, in-flight
flags, memo caches, `let x = null` lazy handles, debounce timers.

⭐⭐ **The tell is cheap and I had it on screen: identical output for base and head.** A fix
that changes nothing is *possible*, but an instrument that cannot see the difference is more
likely — because the fix's author observed the bug on prod and I had not yet reproduced the
guard firing even once. ⇒ **Before reporting "the fix does nothing", require a POSITIVE
control that the guard CAN fire in my harness** (e.g. patch in an extra check and watch the
output change). I only got there by accident, via a patched-control run I had written for a
different purpose.

⚠️ Related trap in the same harness: a stub `innerHTML` setter must **drop children** the way
the real one does, or a scenario about a stale run wiping a pane silently cannot reproduce.

See also [[feedback_a_control_validates_the_instrument_never_the_target]],
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]],
[[project_nanoclaw_1182_guard_covers_appends_not_innerhtml]].

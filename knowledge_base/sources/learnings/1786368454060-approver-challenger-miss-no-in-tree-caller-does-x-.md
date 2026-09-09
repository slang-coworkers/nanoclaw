---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786364740587-8s4oti
written_at: 2026-08-10T13:27:34.060Z
---

# [approver/challenger-miss] "No in-tree caller does X" is not "X is forbidden" — public extension points sample the wrong population

**Symptom.** On slang-rhi#822 I found a real hazard myself, then cleared it with reasoning that felt mechanical but sampled the wrong set. The PR introduced a new `std::mutex m_compileMutex` and, inside the locked region, invoked a **user-supplied `IDebugCallback`** (`src/shader.cpp:112` holds the lock → `reportEntryPointCompilation` → `device->handleMessage` at `src/shader.cpp:205`). A callback that synchronously creates a pipeline from the same `ShaderProgram` deadlocks deterministically on a non-recursive mutex. I rated it advisory and proposed WOULD_APPROVE. An independent DECISION_REVIEW critique reversed it to `ABSTAIN_POLICY:CRITIQUE_MUSTFIX`.

**Root cause — two distinct errors, both of which felt like diligence:**

1. **Wrong population.** I grepped every in-tree implementation of the callback (`tests/testing.cpp:165`, `:207`), found both were pure string sinks that never re-enter the RHI, and treated that as clearance. But `IDebugCallback` is a **public extension point**: the implementations that matter are the ones *not in the tree*. Enumerating in-tree implementors of a public interface is a complete enumeration of an irrelevant set. It passes the "run the check, don't reason about it" bar while measuring nothing.

2. **Null result read as a negative.** I wrote down the falsifier — "any documented permission for a callback to re-enter the device" — ran it, found nothing, and scored that as *prohibition*. The public contract (`include/slang-rhi.h:3198-3208`) mandates only thread-safety and says nothing about re-entry. **Silence in a contract is silence.** For a callback the default reading favours the caller: ⇒ **a contract that doesn't forbid it permits it.**

I also weighed *likelihood* ("nobody would call back in from a diagnostic sink") against a **deterministic** deadlock — severity direction backwards. Step 3's bar is a plausible trigger with real blast radius ⇒ OPEN_GAP; uncertainty ⇒ ABSTAIN.

**How to catch it.** When clearing a hazard on any **public** API surface (callback, virtual, interface, plugin hook), ask before writing the clearance: *is the set I just enumerated the set that can actually trigger this?* If the trigger requires an external implementor, in-tree enumeration is inadmissible and only a **contractual** invariant clears it — a documented prohibition, an assert, or a structural impossibility. Distinguish these three, which are not interchangeable:
- "no in-tree caller does X" — a fact about this repo, not about X;
- "the contract forbids X" — clears it;
- "the contract is silent on X" — does **not** clear it; it *permits* X.

**Fix.** Cheap and structural: hoist the callback out of the locked region, or state non-reentrancy in the `IDebugCallback` doc comment. Because the fix is one decision wide, handing it to a human costs almost nothing — which is itself the tell that abstaining was right.

**Transferable form.** Newly wrapping *existing* callback invocations in a *new* lock is a recurring refactor shape (staging work for future parallelism). The old call site was safe because nothing was held; the new one is not. When a diff adds a lock, enumerate **every** call that escapes user-supplied code while it is held — that set is the change's real blast radius, and it is invisible in a green CI run because no in-tree test implements the adversarial callback.

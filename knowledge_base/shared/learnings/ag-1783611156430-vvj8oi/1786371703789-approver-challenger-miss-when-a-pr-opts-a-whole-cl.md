---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786369636777-lz4v1b
written_at: 2026-08-10T14:21:43.789Z
---

# [approver/challenger-miss] When a PR opts a whole class into concurrency, audit the guard's scope against EVERY sibling entry point that touches the same shared state

# A new lock added by a parallelism PR is scoped to the path the author was thinking about, not to the state

**Symptom.** slang-rhi#824 ("Create supported backend pipelines in parallel")
added a process-wide mutex around a device-scoped NVAPI global-state window in
`createRayTracingPipeline2`, deleting a pre-existing TODO that had warned
*"This sets global state! Need to revisit if createRayTracingPipeline2 can get
called from multiple threads."* The mutex looks like a careful, complete answer
to that TODO: correct scope-based cleanup via a deferred block, reset on failure
paths as well as success, an explicit comment explaining the process-wide choice.

The defect is not in the lock. It is that **the same PR opted the whole pipeline
class into concurrency** — the D3D12 capability hook returns `true`
unconditionally with `SLANG_UNUSED(pipeline)` — so render and compute PSO
creation became concurrent too, and those two sibling functions
(`NvAPI_D3D12_CreateGraphicsPipelineState`, `NvAPI_D3D12_CreateComputePipelineState`)
never take the new mutex. A device-scoped "affects subsequent pipeline creations"
option set by an RT worker can overlap an unrelated PSO creation on another
worker. Blast radius is a **silent wrong-state** PSO, not a crash.

**Root cause of the review miss (the transferable part).** The author's TODO
framed the hazard as *"can `createRayTracingPipeline2` be called from multiple
threads?"* — and the fix answers that question correctly. But the real question
is *"can the state this function mutates be observed by anything else that is now
concurrent?"* Reviewing the lock against the TODO that motivated it reproduces the
author's framing and inherits its blind spot. **A guard's correctness is judged
against the STATE's reachability, never against the narrative that introduced the
guard.**

**How to catch it — the probe.** For any PR that flips a class of work onto
worker threads (a capability hook, a `parallel` mode, a task-pool submission):

1. **Enumerate what the opt-in actually widened.** A hook returning `true` with
   the discriminant parameter unused means *every* subtype opted in. Read the
   hook body, not the PR summary's list of backends.
2. **For every new lock, grep every call site of the state it protects** — not
   just the enclosing function. If the state is device- or process-scoped, the
   population is all sibling entry points on that device, including ones the diff
   never touched.
3. **Asymmetric scopes in one lock body are the tell.** Here two vendor calls sit
   inside one mutex: one thread-local (`...LocalThread` suffix) and one
   device-scoped. When a single critical section mixes per-thread and shared
   state, the shared one almost always leaks past the section's reach.
4. **A deleted TODO/warning is a review anchor.** Diff for removed
   `TODO`/`FIXME`/`WARNING` comments and ask whether the replacement covers
   everything the comment feared, or only the instance in front of it.

**And check whether CI can even see it.** The NVAPI path here was *compiled*
(`-- Fetching NVAPI ...`, objects built) but never *executed* — the runner's GPU
reported `SKIPPED (Device does not support NVAPI)`. So a fully green 22/22 with
1287/1287 tests carried **zero bits** about this finding, while genuinely
covering the non-NVAPI parallel path (which passed on real D3D12 hardware via a
real threaded pool). Scope the green honestly in both directions rather than
collapsing to "CI proves nothing" or "CI proves it works": read skip REASONS per
capability, and state which direction the control covers.

**When to abstain instead of block.** The decisive premise here — whether the
vendor option affects graphics/compute PSO creation or only ray-tracing state
object creation — was **unresolvable** in-container: the vendor header is fetched
at configure time and absent, deepwiki could not determine the scope, a WebFetch
of the upstream header truncated before the relevant section, and WebSearch
errored. That is `ABSTAIN_POLICY:OPEN_GAP`, not `BLOCK`: a plausible reachable
trigger with real blast radius, cheap for the author (who has the docs) to
settle, and no verified bug demonstrated. **Naming the unresolved premise
explicitly is what keeps an abstain honest — and what stops it from silently
rounding up to approve.**

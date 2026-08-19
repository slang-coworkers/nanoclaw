---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787042850533-jf9tsz
written_at: 2026-08-18T09:26:41.985Z
---

# [approver/challenger-miss] Lifetime-fix regression tests need an independent-free control (device-close false-safe)

**Symptom.** slangpy#1113 "Fix layout cache lifetime issues" adds `~BaseModule` → `Layout::clear_caches()` to break a real `Layout ⇄ Type/Function` refcount cycle, plus ONE regression test: load module → call function (populates caches) → `device.close(); module=None; device=None; gc.collect()` → assert `len(get_created_devices())` back to baseline. Fix mechanism is genuinely correct+safe (verified from source). Both bots clean. Easy WOULD_APPROVE.

**Root cause of the trap.** The test's pass is a *negative observation* (device count returned to baseline). Ask the standing probe: could it come out green WITHOUT the fix? Trace the device-retention paths on `main`:
- `Device::close()` calls `invalidate_reflection_data(this)` (device.cpp:541, from a PRIOR PR #1047), which sets `m_owner=nullptr` on every low-level reflection object (reflection.h:199) — severing `ProgramLayout → owner(SlangModule) → Session → Device`.
- The object whose leak the fix repairs (`refl::Layout` cycle) sits with `BaseModule` OUTSIDE it — `BaseModule` holds `ref<Layout>`, nothing in the cycle holds `BaseModule`. So `module=None` frees `BaseModule → m_module → Session → Device` INDEPENDENT of the new destructor.
→ The device is plausibly freed on `main` regardless, so the test is green either way and carries ~0 bits about the fix. The `refl::Layout` leak the fix actually fixes is NOT what `get_created_devices()` measures.

**How to catch it.** For any lifetime/leak-fix PR whose evidence is "object X is freed after teardown": (1) identify the SPECIFIC edge the fix removes; (2) enumerate EVERY OTHER strong-ref path from the teardown trigger to X — a fix-independent path (esp. one added by an earlier close()-time invalidation PR) means the test can't discriminate; (3) confirm whether the leaked object and the asserted-freed object are even the same thing (here: leaked = refl::Layout graph; asserted = Device — different). The discriminating test is a revert-drill (remove the fix, test must fail) — if you can't run it read-only, that inability is itself the ABSTAIN.

**Fix.** ABSTAIN_POLICY:OPEN_GAP (not BLOCK — code is correct). A correct fix with a non-discriminating test is still an open gap: a future removal of `~BaseModule` wouldn't be caught. Human should confirm the test fails on main without the destructor, or add coverage that targets the refl::Layout leak directly (e.g. assert the reflection graph / type-cache is emptied, or use a leak/refcount probe on Layout).

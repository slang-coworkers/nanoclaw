---
name: PENDING maintainer decision — #11759 concurrency contract
description: slang #11759 parallelGenericEntryPointCompile RPC crash — chain parked at fix-layer fork awaiting jkwak-work's #10792 concurrency-contract answer
type: project
originSessionId: c3aa77cf-6af5-4b3e-a62b-b70854784406
---
shader-slang/slang #11759 — `parallelGenericEntryPointCompile.internal` RPC failures in CI. Chain triaged + diagnosed (diagnose-only, approach C), parked at the fix-layer fork as of 2026-06-25.

**PROVEN (independently verified by triager at master a7fbf1ab0):** The CI `JSON RPC failure: waitForResult()/hasMessage()` is a *symptom* — the test-server child crashes mid-test. Frontend is ALREADY serialized (specialize/createCompositeComponentType/link/getTargetProgram/getOrCreateLayout all take `Linkage::m_componentTypeOperationMutex`, slang-session.h:246). The BACKEND codegen path `getEntryPointCode`→…→`linkIR` runs UNGUARDED (only result-cache publish locked). The test drives that path concurrently from 20 threads over a SHARED Linkage+module → reliably crashes. Genuine residual bug, **unmasked (not caused) by #11753** (which made result-code-0 count as Fail, ending a false-green). Cluster: #11720 (parent) / #11751 (fixed by #11753) / #11755 (sibling).

**DISPUTED (do NOT treat as settled):** the EXACT racing structure. Fixer infers a shared specialization/symbol cache mutated in linkIR; triager's independent pass found that path builds thread-local IR copies + reads shared modules immutably. Crash is real regardless; exact container needs ASan to pin.

**Why:** The fix-LAYER choice is a maintainer design call, not ours. Contract question routed to jkwak-work (issue author, owns #10792) via GitHub comment on #11759: *"Is concurrent getEntryPointCode across distinct linked programs that share ONE Linkage+module within the intended parallel-backend contract (#10792)? YES → harden codegen/linkIR thread-safety. NARROWER granularity → test out of contract → per-thread sessions."*

**How to apply:** Chain is PARKED. ASan is HELD (only needed in the "harden" branch, at fix-time; ~9-10G build, disk was at 94% on 2026-06-25 — defer). A substantive jkwak/maintainer reply (via webhook) re-opens to pick A (harden compiler) vs B (re-scope test); triager rolls up to me, I authorize the fix-layer release. Until then: green-light only diagnostics, NOT a committed fix. Keep PROVEN-vs-DISPUTED separation; don't let the fixer's inferred mechanism harden into fact.

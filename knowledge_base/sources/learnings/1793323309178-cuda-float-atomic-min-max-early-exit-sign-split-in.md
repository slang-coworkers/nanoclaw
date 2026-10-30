---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291589507-vskx9v
written_at: 2026-10-30T01:21:49.178Z
---

# CUDA float atomic min/max: early-exit + sign-split integer atomic beats a CAS loop ~2x; a sign-split without early exit is SLOWER; void form becomes red+REDUX

Measured on L40S (nvcc 12.6, sm_89, 64-256K threads updating 6 shared words) for slang PR #14048 (#14026): (1) A CAS loop with an early exit (load; return if the stored value already wins) is fast because most reduction updates lose. (2) A sign-split integer atomic (signed atomicMin for v>=0, unsigned atomicMax for v<0; mirror for max) that ALWAYS issues the atomic and uses its return value is 2-10x SLOWER than that CAS loop. (3) If its result is unused, ptxas turns it into RED + REDUX (warp aggregation) and it is 5-14x faster than the CAS loop. (4) Best exact form: load → ignore NaN operand → atomicCAS-replace a stored NaN → early exit → one sign-split atomic → check the returned original for a NaN that the integer atomic kept (stored concurrently), retry via CAS. ~1.7-2.1x faster than the CAS loop for float, 1.6-2.0x for double, equal on all-equal data; the post-check reads the return so the RED/REDUX path is lost (another 2-3x). Naive sign-split keeps a stored +NaN under max and a stored -NaN under min — OpAtomicFMinEXT requires replacing them. -0.0 < +0.0 in integer order is allowed by the spec. Half has no 16-bit integer atomicMin/Max in CUDA, so it needs the CAS loop. Check SASS with `cuobjdump -sass -fun <mangled>` | grep REDUX/RED/ATOMG.

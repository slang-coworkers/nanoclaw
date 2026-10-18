---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539184926-uximgs
written_at: 2026-10-18T05:30:51.882Z
---

# Run a reviewer's shapes plus a NON-recursive control before calling a residual 'recursion-only'

On slang#12563 a residual false E58005 was framed for weeks as "mutual recursion only, under -disable-non-essential-validations, diagnostic precision". Compiling a non-recursive control (`int* r; if(c) r=&gShared; else r=helper(); return r;`) showed the same false E58005 in DEFAULT mode: the address-space slot pre-pass ran before the worklist fixpoint settled call results, so `getStoredValueAddrSpace` read the call's declared `Ptr<T>` default (PhysicalStorageBuffer) as a second storage class. Rule: before scoping a residual to an exotic flag/shape, strip the exotic part and re-run; and for any pre-pass that runs before a fixpoint, treat every not-yet-settled value (calls, params) as unknown. Also: when suppressing provisional recursive results, key the suppression on the back-edge CALL inst, not the function — a root-wide set hid a real E58003 from a settled call to the same function outside the cycle. And build the reviewer's exact reviewed head as the baseline (not a master build) when claiming "fails before / passes after".

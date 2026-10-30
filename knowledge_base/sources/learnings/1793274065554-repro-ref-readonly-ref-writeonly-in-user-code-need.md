---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793273674996-fky306
written_at: 2026-10-29T11:41:05.554Z
---

# Repro __ref_readonly/__ref_writeonly in user code needs -experimental-feature (E30133); ref-arg stage split

Since #13406 (master 0bd71cd70+), `__ref_readonly` / `__ref_writeonly` in user .slang files are rejected with E30133 "reference access keyword requires '-experimental-feature'" unless you pass `-experimental-feature` to slangc; plain `__ref` is not gated. Issue texts (e.g. #13831, #13837) omit the flag, so add it when reproducing.

Also: front-end errors (E30047) stop compilation before lowering, so a multi-call repro only shows the front-end diagnostics; put each call in its own file to see the lowering ones (E40008). On 01dcd35682, the front end accepts any writable l-value for a `__ref` argument (check-expr.cpp:4432 tests only `isLeftValue`), so both a non-contiguous swizzle `v.xz` and a property with a setter fail later, in lowering, with E40008 (slang-lower-to-ir.cpp:9977). Lowering rejects every multi-component swizzle as a ref argument, contiguous or not. `inout` accepts both through a temporary plus write-back.

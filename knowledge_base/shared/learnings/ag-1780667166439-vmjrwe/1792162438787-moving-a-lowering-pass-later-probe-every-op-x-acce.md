---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791310101653-q7uc6d
written_at: 2026-10-16T14:53:58.787Z
---

# Moving a lowering pass later: probe every op x access-form x target against master BEFORE review

#13446 (#13699) moved legalizeMatrixTypes after buffer lowering. Two review rounds then found 5 regressions, each a shape a pass had never seen before:
- legalizeBinaryOp: int-matrix division, and a matrix-typed shift amount;
- lowerMatrixAddresses: SwizzledStore, a padded std140 vec4 row read as vec3, and a scalar row of a one-column matrix (both load and store);
- findLeafValueAtOffset: wrong row index, which also broke float bit_cast.

What found them fast: a generated probe set (about 25 binary/unary ops × int/uint/bool, plus about 20 buffer access forms: swizzle store, `+=` through a swizzle, row store, element store, cb row/whole, transpose, mul, casts, BAB, inout params). Compile every probe on spirv/glsl/wgsl/metal with master and head and diff the status, then run Tint on all WGSL output (`node /workspace/agent/tools/tint-13635/tint-validate.mjs *.wgsl`, dawn.node null backend). FileCheck legs alone passed two invalid WGSL outputs. Note that `wgsl-spirv-asm` test legs are ignored on Linux: slang-tint is fetched only on Windows x64.

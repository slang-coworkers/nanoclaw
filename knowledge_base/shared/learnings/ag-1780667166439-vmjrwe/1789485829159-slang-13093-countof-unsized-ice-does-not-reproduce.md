---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789484457361-7fqe1p
written_at: 2026-09-15T15:23:49.159Z
---

# slang#13093 countof-unsized ICE does NOT reproduce at HEAD — folds to sizeof-byte-width (4)

**Finding (verified at shader-slang/slang `c8ba692945`, fresh Debug slangc build, two independent runs):** issue #13093 claims `countof` on a truly-unsized array (`int gArr[]; outBuf[0] = countof(gArr);`) ICEs at code emit with `internal error[E99999]: unexpected IR opcode during code emit`. It does **not** ICE at this HEAD. On **every** target (cpp, spirv, hlsl, glsl, cuda) it compiles cleanly (exit 0) and folds `countof(gArr)` to the constant **4** = `sizeof(int)` byte width — cpp `= int(4)`, spirv `%int_4 = OpConstant %int 4`, glsl `= 4`. The fixed-size case `int fixed[8]; countof(fixed)` also folds to **4** (should be 8).

**Why this matters:** the observable defect at HEAD is a **silent wrong-value fold (sizeof-byte-width), NOT an internal-error ICE** — the same #11317-class bug (#12507 is its unmerged fix). A triage that reasons purely from source-trace ("unsized → no natural size → un-foldable `kIROp_CountOf` → emit ICE") can be wrong: in practice `countof` on an array goes through the wrong-value fold path first, so no `kIROp_CountOf` reaches emit for this repro. To actually surface an emit-time `kIROp_CountOf`/ICE you'd need a repro where the fold path cannot compute a byte size.

**Lesson:** when a triage memo says the symptom "needs a HEAD build to confirm" and the prebuilt showed a *different* symptom (a fold, not an ICE), treat the ICE claim as unverified — the prebuilt's behavior is often the truth. Always empirically confirm the exact claimed symptom at HEAD before writing a fix/test that asserts "ICE gone." A checker-level fix that rejects `countof(unsized)` with E56002 ("cannot obtain the size of an unsized array", matching `arr.getCount()`/`kIROp_GetArrayLength`) is still a valid improvement, but it fixes a wrong-value miscompile, not an ICE — the PR framing and test must say so.

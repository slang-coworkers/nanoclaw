---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789311609693-3hqgcr
written_at: 2026-09-14T17:11:19.202Z
---

# Slang: use slang.numerics for generic numeric code; IFloat/IArithmetic/IComparable are frozen

## Maintainer-stated direction on Slang numeric interfaces (2026-09, issue #13045)

**Rule for coworkers:** When a request asks to make a math builtin (`abs`, `pow`, `clamp`, `saturate`, `floor`, `sign`, …) work on a generic numeric type, the go-forward answer is the **experimental `slang.numerics` modules** — NOT a one-off low-rank overload extending the old `IFloat` / `IArithmetic` / `IComparable` interfaces.

**What the maintainers said (source below):**
- `tangent-vector`: "`slang.numerics` is the new recommended set of interfaces for numeric types for all Slang users, and we will advise users *against* using `IFloat`, `IArithmetic`, `IComparable`, etc." The old interfaces "can't be extended with new requirements without risk of breaking existing user code (especially user code that defined their own conformances)." Numeric interfaces stay in an **experimental module** so they can keep evolving; the `IFloat` mistake was "prematurely binding ourselves to a backwards-compatibility contract for API designs that hadn't yet been battle-tested."
- `jvepsalainen-nv`: generic `abs` already **landed via #12859** in `slang.numerics`, verified across hlsl/spirv/cpp/cuda/metal/glsl/wgsl (scalar + `float3`) with correct derivatives. Working path: `import slang.numerics.differentiable;` + constraint `T : IDifferentiableFloatingPoint`, under `-experimental-feature`. Note: `IFloat` does **not** conform to `ISignedNumeric`, so the new overload won't apply to an `IFloat`-constrained generic — the user must switch the constraint over. Same story for `pow` (#12591).

**Why this matters for triage/fix:** The precedented "mirror the merged min/max→IComparable overload (#9593) as a low-rank `abs<T:IFloat>` overload" pattern (an attractive Approach A) is now the thing maintainers explicitly advise against, because it extends a frozen interface. Any triage recommending extension of `IFloat`/`IArithmetic`/`IComparable` should be steered to `slang.numerics` instead. This is also a reminder: for entangled numeric-interface feature requests, **coordinate/hold and surface the direction to maintainers rather than racing a fix** — doing so here avoided shipping a wrong-direction overload.

**Source:** shader-slang/slang#13045 comments — jvepsalainen-nv (5666168565), tangent-vector (5667771221). Feature landed in #12859. Related: #12591 (pow), #9593 (min/max precedent, merged), #11075/#12249 (vector-codegen ICE the old pattern shared).

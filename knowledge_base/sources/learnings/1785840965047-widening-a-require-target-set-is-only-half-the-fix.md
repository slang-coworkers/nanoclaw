# Widening a [require] target set is only half the fix — pair it with the __target_switch case (metal fwidth #12165)

## Rule

When you **add** a target atom to an intrinsic's `[require(...)]` in `*.meta.slang`, you must check
whether that intrinsic's `__target_switch` body has a `case <target>:` **or** a `default:`. If it has
neither, the require-clause edit alone converts a **clear front-end diagnostic** (`error[E36107]:
unavailable features in entry point`) into an **unhandled-target gap at emit** — strictly worse,
because the user loses the actionable error and gets an obscure codegen failure or empty body instead.

The two edits are one atomic fix: **`[require]` widening + body `case`** (or an existing `default:`).

## Why — verified on shader-slang/slang#12165 (fixed, PR #12172 merged `ebed5178f0`)

Reporter hit `fwidth(input.uv)` on a `float2` in a `[shader("fragment")]` entry point for
`-target metal` → `E36107`. The question was whether Metal lacks fragment derivatives (real gap) or
the stdlib annotation was wrong (incorrect annotation). **It was the annotation.**

Root cause: only the **scalar** `fwidth` overload declared `metal`. The **vector** and **matrix**
overloads did not:

| Overload | `[require(...)]` before fix | Body |
|---|---|---|
| scalar `fwidth(T)` | `glsl_hlsl_metal_spirv_wgsl` ✅ | has `case metal:` |
| vector `fwidth(vector<T,N>)` | `glsl_hlsl_spirv_wgsl` ❌ | `__target_switch`, **no `case metal:`, no `default:`** |
| matrix `fwidth(matrix<T,N,M>)` | `glsl_hlsl_spirv` ❌ | `default: MATRIX_MAP_UNARY` ✅ |

So the fix was **asymmetric across the two broken overloads**, and that asymmetry is the whole point:

- **vector** needed `metal` in `[require]` **AND** `case metal: __intrinsic_asm "fwidth($0)";` —
  because its switch had no `default:` to fall through to.
- **matrix** needed only the `[require]` edit (`metal` + `wgsl`) — its `default: MATRIX_MAP_UNARY`
  already recurses to the scalar overload element-wise, which was already Metal-capable.

Requiring-only on the vector overload would have compiled the capability check and then hit a
case-less switch.

## How to tell "real target gap" from "wrong annotation"

The decisive evidence was a **sibling intrinsic with the same semantics**: `ddx`/`ddy` carry
`cpp_cuda_glsl_hlsl_metal_spirv_wgsl` on **all three** overloads. Since `fwidth ≡ abs(ddx) + abs(ddy)`,
`fwidth` must be available wherever `ddx`/`ddy` are. Independently, the `fragmentprocessing`
capability atom (`slang-capabilities.capdef:2344`) explicitly lists `fragment + metal` — so the atom
was correct and only the require clauses were wrong. **Check the atom and a semantic sibling before
concluding a target is incapable.**

## Guardrail — do NOT widen the coarse/fine variants

`fwidth_coarse` / `fwidth_fine` (and the `ddx_coarse`/`ddy_fine` family) use
`fragmentprocessing_derivativecontrol` and **correctly** omit `metal`: Metal has no coarse/fine
derivative control. Verified post-fix at HEAD `0864e60e6` that `fwidth_coarse` for `-target metal`
**still** raises `E36107`, with a `-target spirv` control passing to prove the rejection is
Metal-specific and not a broken intrinsic. A future reader must not mistake that correct rejection
for a regression of this fix.

## Relationship to the case-less-switch learning (`1785418069559`)

That learning is the **inverse direction** and the two together cover the mechanic:

- **Removing** an incapable target (#12274): a case-less `__target_switch` makes the *method-level*
  `[require]` **inert as a gate** (empty inferred body ⇒ trivially passes) — the effective gate is the
  *type-level* `[require]`.
- **Adding** a capable target (#12165, this note): the same missing case flips from *inert gate* to
  *unhandled emit*.

Same structural fact — a switch with no arm for the active target — with opposite consequences
depending on which way you move the clause. Always read the body, never just the clause.

## Method note that generalized

On a **terminal-chain replay** (an inbound for an issue already fixed/merged/closed), re-verifying the
fixed instance only re-proves what the merge already claimed. The step that can come out differently
is sweeping the **defect class** — here "same intrinsic, inconsistent target sets across
scalar/vector/matrix". Swept all `fragmentprocessing` families at HEAD: `ddx`/`ddy` all-targets,
`fwidth` all-targets, `EvaluateAttributeAtCentroid`/`AtSample`/`Snapped` uniformly `glsl_hlsl_spirv`,
coarse/fine uniformly `glsl_hlsl_spirv` ⇒ **class closed, no residual sibling**. That converts a
wasted cycle into a fact. Also: source state is not behavior — the merged diff being present at HEAD
was confirmed by *running* the reporter's exact repro (compiles, emits `fwidth((_S1.uv_0))`), not by
diffing source.

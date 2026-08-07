---
name: feedback_a_name_scoped_capability_negative_survives_every_widening
description: "Three independent-looking probes (spec legend, in-tree grep, live compiler rejection) all keyed on the identifier `dot` agreed GLSL has no integer dot — it exists as `dotEXT`. Controls keyed on one NAME are one control; extensions rename identifiers, so widen the KEY, not the search."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d67fce4e-3bdb-4346-9e59-cfcfa799845c
---

# A capability-negative keyed on an identifier survives every widening of the search

**Why:** the [[feedback_published_negative_env_claims_need_rederivation]] guard says re-derive a
negative with the capability itself, not a proxy, and enumerate every standard location. I did
*better* than that here and still published a false negative — because every probe I ran, and every
probe I asked for, was keyed on **the same identifier**. A vendor/extension suffix (`EXT`, `KHR`,
`ARB`, `NV`) renames the function; a name-keyed search cannot see past the rename no matter how many
independent sources you consult or how deep you go in each.

## First-person receipt (2026-08-06, shader-slang/slang#12403)

Dispatching `slang-triager` on the integer-`dot` fallback issue, I challenged the issue body's claim
that a native `glsl`/`metal` arm was a viable remedy:

> I believe that is **wrong**: GLSL's `dot` is floating-point-only (§8.5 — `genType` = `float`/`vecN`,
> `genDType` for doubles; there is no integer form) … consistent with `slang-glsl-module` containing
> no native integer `dot` definition (only one call site, `glsl.meta.slang:915`). **If it holds,
> option 2 is infeasible and the open question collapses to a single answer.**

The triager then confirmed it three more ways, and every confirmation was true:

| probe | result | keyed on |
|---|---|---|
| my in-tree grep of `slang-glsl-module` | no integer `dot` | `dot` |
| GLSL 4.60 §8.5 declaration legend — `genIType`/`genUType` defined and used at **32** other sites, `dot` at 0 of them | deliberate exclusion, not omission | `dot` |
| **live glslang** (`dlopen` Slang's bundled `.so`, `glslang_compile`) — `dot(ivec3,ivec3)` rejected, float control passes, bogus-function guilty control fails | rejected | `dot` |

That is a *failable* control with a working guilty cell — the standard this store demands — and it
was still blind. **GLSL has integer dot as `dotEXT`, under `GL_EXT_integer_dot_product`**
(bundled `external/glslang/glslang/MachineIndependent/Initialize.cpp:2300`; 8/16/32/64-bit, vec2/3/4).
Found by codex, not by any of the four probes. The triager verified the shape: `dotEXT(ivec3,ivec3)`
compiles with the extension; plain `dot` still fails **even with the extension enabled**; and the
`KHR` spelling both of us reached for is not recognised at all.

⇒ The spec finding was not merely incomplete, it was *actively misleading*: §8.5's exclusion of
`genIType` from `dot` is real and deliberate **because the integer form lives in an extension under a
different name**. The cleanest evidence for the negative was a direct consequence of the positive.

## The structural point

⭐⭐⭐ **Probes that differ in source but share a search key are ONE probe.** Spec text, in-tree
grep, and a live compiler rejection look maximally independent — different artifacts, different
failure modes, one of them executable. They agreed because they were all asked *"is there a `dot`
that takes integers?"* and the true question was *"is there an integer dot product?"* Independence
has to be measured over the **key**, not the source.

### ⭐⭐⭐ GENERALIZATION 2026-08-06 — the shared key need not be a NAME. Three instances in one day.

The mechanism is **apparent independence with a shared root**; an identifier was just this chain's
version of that root. Same day, three subsystems, same class:

| apparently independent signals | the shared root | caught by |
|---|---|---|
| 3 probes agreeing GLSL has no integer `dot` | the identifier `dot` (it exists as `dotEXT`) | me |
| my "independent confirmation" of a peer's causal story | **direction of authorship** in a two-sided diff | its reviewer |
| clarity candidate files read as "Reviewer C" | **one authoring session** — they were Reviewer *A*'s own clarity subagent output, sitting in A's repo root | `slang-reviewer` |

⛔ **The third is the most dangerous form, because a 3-reviewer pipeline's ENTIRE value is
independence.** Merging A's own subagent output as "C" fabricates a third signal — two votes reported
as three, and nothing downstream can tell.

⇒ ⭐⭐⭐ **Discriminate by the AUTHORING RECORD, never by LOCATION.** The reviewer's form: the `Write`
payload's `session_id`, not the path. Third time in one day the filesystem proved attribution-free
(also: a sibling's `wt-*-scratch-log.md` visible on shared disk; `git stash` being **per-clone**, not
per-worktree). **N agents on one disk ⇒ a path is not a provenance claim.** See
[[feedback_thread_id_is_my_inference_in_reply_to_is_the_record]],
[[feedback_a_diff_marker_describes_a_state_not_an_action]].

⚠️ **A guard can be false in BOTH directions.** Same report: Reviewer A's runner guard announced *"zero
subagent dispatches / 0 bytes"* while **7 subagents had run over 119 turns**, producing a complete
16.8 KB review (recovered from `stream.jsonl`). A guard that under-reports your own completed work is
worse than none — its failure is indistinguishable from its finding in *either* direction. ⇒ rule 4
below applies to guards too: **name the key the guard read.**

⭐⭐ **An extension-suffixed identifier is the specific, enumerable form this takes in graphics
APIs** — `EXT` / `KHR` / `ARB` / `NV` / `OES`, plus the SPIR-V `Op*KHR` twins. It is also where the
name does *not* transfer between ecosystems: `SPV_KHR_integer_dot_product` (which Slang already uses
at `hlsl.meta.slang:10179`) and `GL_EXT_integer_dot_product` describe the same hardware capability
under **different vendor tags** — so knowing the SPIR-V spelling actively misled us on the GLSL one.

⚠️ **Note what the hedge did and did not buy.** I wrote *"Verify against the GLSL and MSL specs
rather than taking my word"* and named my method — per this store's rule. That was worth something:
it made the correction legitimate rather than a contradiction, and the triager repaired the issue
body without friction. But **the hedge named the wrong method to re-run.** "Check the spec" is the
instruction that produces the 32-site legend finding — i.e. it steers the verifier *deeper into the
same key*. A hedge that names your method only helps if the method's blind spot is not what is at
issue; here it was.

## How to apply

1. **Before publishing "API X has no operation Y," search the CAPABILITY, not the name.** Grep the
   target compiler's builtin table for the *operand shape* (`ivec3`, `i8vec2`) or the concept
   (`integer_dot`, `dot_product`), not the identifier you expect. One grep of
   `Initialize.cpp` for `integer_dot` would have found this in seconds.
2. **Enumerate the suffix set explicitly** when the domain is GL/Vulkan/SPIR-V/MSL: try
   `Y`, `YEXT`, `YKHR`, `YARB`, `YNV`, `YOES`. Cheap, mechanical, and it converts a name-scoped
   probe into a capability-scoped one.
3. **Never carry a vendor tag across ecosystems.** Having `SPV_KHR_<foo>` in hand predicts that a
   GLSL extension exists; it does **not** predict its tag. Look the GLSL one up by concept.
4. **When counting corroborating probes, list the key each one used.** If the column is constant,
   you have `n=1` — say so. Two tiers agreeing on a name-keyed negative is the convergent form from
   [[feedback_published_negative_env_claims_need_rederivation]], one layer more specific.
5. **A negative that "collapses the design fork to a single answer" is the highest-value one to
   attack**, because it is the one that will be acted on immediately. I flagged mine as decisive in
   the same sentence I published it — correct instinct, and exactly why the key mattered.

# Citations

- Chain: [[project_12403_integer_dot_fallback_glsl_metal]]
- `external/glslang/glslang/MachineIndependent/Initialize.cpp:2300` — `// GL_EXT_integer_dot_product`
- Slang's SPIR-V side, already in tree: `source/slang/hlsl.meta.slang:10179`

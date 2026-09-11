---
name: project_12313_minify_local_obfuscation_source_target
description: "slang#12313 — -minify / -obfuscate-locals feature request. CLOSED 2026-09-03 (completed). No fixer ever dispatched. Durable value = the RETRACTION of the false '-obfuscate breaks reflection' premise + the .slang-module cross-version-incompatibility constraint."
metadata:
  node_type: memory
  type: project
  originSessionId: fbf7712f-eef0-4bbd-b66c-f0f6a48b6d8d
---
# slang#12313 — `-minify` / `-obfuscate-locals` (lightweight text obfuscation)

feature-request/enhancement · P2–P3 · front-end + CLI · author **j8asic** (external contributor).
**✅ CLOSED 2026-09-03T00:50:30Z** (state_reason=completed, closed_by jkwak-work). No fixer ever dispatched.

**The ask:** a text-output obfuscation mode that strips comments/whitespace (preserving
`#if`/`#define`/`import`), renames only local/internal identifiers, and leaves public
globals/cbuffers/ParameterBlocks/binding names intact so host reflection keeps working. Its stated
premise: existing `-obfuscate` is too aggressive and **breaks name-based reflection**.

## ⛔ The central RETRACTION — "`-obfuscate` breaks name-based reflection" was FALSE (published 3×)

`tangent-vector` (senior architect) gave the mechanism; we then **measured it on our own edge**
(`-reflection-json` byte-identical with vs without `-obfuscate`; all public params present in both; a
guilty control absent in both; the emitted HLSL names changed, proving the flag was active in the same
run):

- Obfuscation operates at **Slang IR** level (hashes IR linkage names → `_Sh<hex>`); **reflection vends
  from AST-level layout data**, so hashing IR names cannot touch a name-based reflection query. Confirmed
  by our own docs (`docs/user-guide/a1-03-obfuscation.md`).
- `findParameterByName` **is not a Slang API at all** (only a unit-test helper) — we repeated the
  reporter's prose for a week without checking the symbol existed.
- Retraction posted (triager comment 5220876524), explicitly superseding 5151087614 / 5195672958 /
  5212970698; correction also owed upward to the operator (relayed as VERIFIED for several turns).

**Meta-lessons (the reusable payload):**
1. **A hedge that names the gap does not stop the claim.** The same comment said "a source read, not a
   runtime experiment" and the next sentence asserted the break as "confirmed." ⇒ if a hedge says "not
   measured", the claim it guards may not use the word "confirmed."
2. **When a new fact establishes a mechanism, re-test every earlier claim that rested on the opposite
   mechanism.** We held the refuting `--strip-debug` finding for days and spent it on a different point.
3. A capability claim needs **both** controls: a positive control (the flag did something) and a guilty
   control (the lookup can fail).

## Resolution + durable constraints

- **OP retracted their own premise** (comment 5515407682), confirmed our measurement, adopted csyonghe's
  precompiled `.slang-module` path (blobs embedded as CMRC binary resources, loaded from memory), and
  endorsed closing + listed 10 forward ideas (consolidated in a reply, **not** spun into 10 issues).
- ⭐ **`.slang-module` files are NOT binary-compatible across Slang versions** (jkwak, close comment
  5518620340): a module compiled with one Slang version may not load in another ⇒ embedding blobs ties
  them to the exact Slang runtime version (a rebuild/versioning discipline for a shipping product).
- **The `E20001` boundary:** an `if` controlled by an `extern static const` still requires **both**
  branches to parse and type-check during module precompilation — it is **not** `if constexpr` for an
  otherwise-ill-formed inactive branch. The OP independently arrived at this same boundary.

**HARD CARRY-OVER:** if any obfuscate/shape-changing case ever becomes real work, **re-MEASURE
`-obfuscate` + reflection at live HEAD, never read** — the retraction discipline. Re-opens only on a
substantive non-bot comment on the closed issue.

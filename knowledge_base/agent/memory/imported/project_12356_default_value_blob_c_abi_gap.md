---
name: project_12356_default_value_blob_c_abi_gap
description: "#12356 getDefaultValueBlob has no portable C ABI entry point — bot-filed from Discord (C# binding). Verdict cmt 5187494019 (reflection/client support/DiscordRequest, medium/P2). jkwak-work stated policy: no C API, direction is COM — A/B both declined. tangent-vector+csyonghe: COM canonical, C wrappers generated, reflection is the last holdout. RESUME = a direction from the maintainers → fixer. Nothing touching reflection API shape from us."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5af20928-b81d-40eb-b9dd-cf53994d8cbb
---

shader-slang/slang#12356, opened 2026-08-05 by nv-slang-bot[bot] (our Discord-support chain; reporter **xylisn** on `#slang-dev`, binding from C#). Routed to **slang-triager** on canonical thread `gh-issue-shader-slang/slang-12356`. **State: PARKED on a maintainer design call, then re-opened by the maintainers' own COM-direction discussion (below).**

## The bug (verified at `ff45b15ed` / `b0e43d657`)

`getDefaultValueBlob` (`slang.h:3283`, `SLANG_API SlangResult getDefaultValueBlob(ISlangBlob**)`) is the **only** `SLANG_API` member of `struct VariableReflection` (3197–3297), and the struct has no base clause / no `virtual` ⇒ **no vtable route** either. The deprecated flat exports at `slang-deprecated.h:715/718/721` are each documented "use `getDefaultValueBlob` instead" ⇒ **a C-ABI caller can reach the deprecated API but not its replacement.** That asymmetry is the defect. Doc gap real (`slang.h:3262–3283` says nothing about C-ABI reach).

- **Not a regression:** flat export absent in v2026.11…v2026.14.1; the C++ member first appears in v2026.14; the flat export was removed pre-merge by `de1550a3c` ("Address review comments", 2026-07-03).
- **Intentional omission:** review comment `3519628104` asked "no C entry point — is that intentional?"; author **duckdoom5** replied "yes" (thread resolved). ⚠️ A one-word reply establishes intent, not policy.

## Verdict + reporter unblocked

Triager verdict `5187494019`: labels **reflection + client support + DiscordRequest**, **medium / P2**, Type=Feature (matches originating FR #11106), no assignee. Reporter unblocked without a Slang change via a built-and-linked `extern "C"` shim (`slangShim_reflectionVariable_getDefaultValueBlob`), discriminated under `-Wl,--no-undefined` (real shim links, bogus control fails) — scoped to **Linux x86-64/GCC/Debug**; 32-bit-Windows decoration and Windows import-lib linking named untested.

**Remedy options:** A (flat `slang_*` export in `slang.h`), B (`include/slang-reflection.h`), C (document only — the only one needing no design call, but explicitly does **not** unblock the C# use case). A/B are the same blocker as **[[project_11826_slang_deprecated_audit]]** / #11827 (both closed won't-fix; `include/slang-reflection.h` still does not exist). 🔴 **#11826 hold:** our gap-surfacing comment (`4848500243`) is its last comment, 5 weeks silent; standing instruction is *webhook-driven hold, do NOT re-surface uninvited*. **#12356 is a new occasion, not permission to re-litigate #11826** — any approach to jkwak goes on #12356. (Originating FR #11106 closed `completed` the same minute #11471 merged; see [[project_11471_default_value_blob_reflection_shadow_block]].)

## 🔴 RE-OPENED — jkwak-work stated the policy (cmt 5197373781)

1. *"The lack of C API is intentional because we are going to stick to COM interface."* ⇒ **A and B are BOTH declined; the direction is COM.** Supersedes the one-word `duckdoom5` "yes" as the authoritative reason. ⭐ A maintainer's stated REASON can arrive weeks after the decision and reframe the whole issue: this was never "no home for a C export", it is "C is not the direction."
2. Asked us: is there anything to improve on the COM side for `VariableReflection::getDefaultValueBlob()`?
3. Asked: was the C-API deprecation announced in user-facing docs?

⛔⭐ **Load-bearing finding (Main-verified at HEAD `b0e43d657`): the premise does not describe the reflection surface today — `struct VariableReflection` IS NOT a COM interface, and neither is any other reflection type.** All 8 reflection structs (`Modifier`, `VariableReflection`, `VariableLayoutReflection`, `FunctionReflection`, `GenericReflection`, `EntryPointReflection`, `TypeParameterReflection`, `ShaderReflection`) are plain structs with no base clause / no `SLANG_IID` / no `virtual` (`grep -c SLANG_COM_INTERFACE` over the reflection span → 0; control: 10+ real uses at `:1533-1895`), reached by casting an opaque `SlangReflection*`. So **"stick to COM" is an ASPIRATION for reflection, not a description**, and `getDefaultValueBlob` has **no vtable to improve** as written. Honest answer to Q2: the COM-side improvement is to *make* the reflection surface COM; there is no COM entry point to refine today.

✅ **Q3: no user-facing deprecation announcement exists** (`docs/user-guide/` 0 relevant hits, control 10 files mention reflection). The deprecation is signalled only by the header FILENAME and per-function `/** DEPRECATED */` comments on 3 getters — no compiler-level deprecation attribute (`slang-deprecated.h` has 267 `SLANG_API` decls and ZERO deprecation attributes).

## Architectural direction (tangent-vector cmt 5220676285 + csyonghe consensus)

COM API canonical · C wrappers should be **generated** from it (or both from one source of truth) · **reflection is the last holdout** because it vends pointers to internal compiler objects (AST nodes, type layouts) that cannot easily become COM objects. Two options — **(1) monolithic `IReflection` vending opaque HANDLES** (`TypeLayoutHandle IReflection::getTypeLayoutOfVariableLayout(VariableLayoutHandle)`), downside = loses OOP chaining unless smart-pointers pair an `IReflection*` with a handle; **(2) proxy COM objects** wrapping internals, downside = a whole extra hierarchy + memory management. **He leans (1)** and warns: *"we need to not entangle a port to COM with a redesign."*

✅ **Verified: option 1 is the shape the C API already has** — 180 of 180 distinct `spReflection*` functions already take a handle-family parameter; 75 return one; both his example signatures exist verbatim (`slang-deprecated.h:733-734`, `:521-523`). And **every façade struct has ZERO data members — `this` IS the handle** (`getName()` at `slang.h:3199` is literally `spReflectionVariable_GetName((SlangReflectionVariable*)this)`), so a chaining body has no room for a stored `IReflection*` ⇒ his semi-smart-pointer pairing is a **consequence of the representation**, not a stylistic concession.

## RESUME trigger

A direction from **jkwak / csyonghe / tangent-vector**, or any non-bot comment on #12356 → then a fixer release makes sense. ⛔ **Nothing touching reflection API shape from us** — his scope warning ("do not entangle the COM port with a redesign") binds us too. Still NO second poke on #11826.

## Method lessons (each distilled to its own concept)

diff-the-sets-never-the-counts (a count-vs-count comparison is structurally blind to a false inclusion; the two sides of one control must use the same aperture) · read what a citation ASSERTS, not just that it contains your token (a test proving a cast FAILS matches every grep for that cast) · a match count cannot distinguish an assertion from its retraction — classify the hit ([[feedback_correction_unapplied_until_every_restatement_fixed]]) · a count cannot settle a claim about content or polarity · praise is a diligence slot — a compliment naming a principle must be checked against *every* artifact you produced, not the one being praised ([[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]]) · a gap is a claim about a store — measure it by READING before filling it, and an edge into an existing enumeration usually beats a new note ([[reference_shared_learnings_correction_is_two_actor]]) · a caveat can become FALSE, not merely stale — delete it, don't annotate, once the condition it describes is fixed · publishing a claim installed in another store on your word makes verification yours alone and immediate.

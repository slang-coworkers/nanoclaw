---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787299482318-1dzuw8
written_at: 2026-08-21T08:27:33.078Z
---

# [approver/challenger-probe] new reject/gate keyed to isFromCoreModule — probe the builtin non-core modules (hlsl/glsl/diff meta), not just core.meta

**Symptom (class):** A PR adds a NEW rejection or gate on a modifier/decoration that is "builtin-only", predicated on `isFromCoreModule(decl)` (or any `FromCoreModuleModifier` ancestor walk). The decisive risk is OVER-rejection: does the new reject fire on a *legitimate* builtin use and break the compiler's own module build? The trap is to grep only `core.meta.slang`, see the modifier lives "in the core module", and wave it through. Example: shader-slang/slang#12538 (WOULD_APPROVE @66e928c7) rejecting `MagicTypeModifier`/`BuiltinTypeModifier`/`BuiltinRequirementModifier` on non-core decls.

**Root cause / why the cheap grep misleads:** these modifiers are ALSO used in `hlsl.meta.slang` (dozens), `glsl.meta.slang`, and `diff.meta.slang` — NOT just `core.meta.slang`. Whether those get rejected depends entirely on whether `isFromCoreModule` returns true for them.

**How to catch it (mechanical probe, cheapest-first):**
1. `git grep -n <modifier keywords> <sha> -- '*.meta.slang' '*.slang'` across the WHOLE tree, then `awk -F: '{print $2}' | sort | uniq -c` to list every file that uses it. Note every non-`core.meta` module.
2. Confirm the predicate covers them. In slang: `Session::addBuiltinSource` (`slang-global-session.cpp`) sets `m_isCoreModuleCode=true`; that attaches `FromCoreModuleModifier` (`slang-compile-request.cpp` ~:296). `getBuiltinModuleSource` routes BOTH the Core module (core+hlsl+autodiff/diff) AND the GLSL module through `addBuiltinSource` ⇒ ALL of core/hlsl/glsl/diff meta are `isFromCoreModule==true` ⇒ NOT rejected. So the reject only hits genuine user decls. VERIFIED true for #12538 → over-rejection refuted.
3. Confirm zero legitimate USER use in-tree: grep `tests/`, `source/standard-modules/`, `prelude/` for the keywords (excluding the PR's own new test).
4. If a sibling keyword must stay valid for users (here `__intrinsic_type`), confirm the parser maps it to a DIFFERENT modifier class (`parseIntrinsicTypeModifier`→`IntrinsicTypeModifier`, distinct from the rejected set) so the test's negative control is sound.

**Also dismissed here:** the "modifier deny-by-default cannot ship as a hard error (breaking)" prior (from the nesting deny-by-default learning) does NOT apply to a NARROW reject of a few crash-inducing internal modifiers that have zero valid user use — there's no previously-valid code to break, so no warn-first/language-version gate is needed. Distinguish "blanket deny over 100+ node types with `default:return true`" from "reject exactly N internal classes."

**Fix / takeaway:** For any `isFromCoreModule`-keyed reject, the over-rejection probe is: enumerate ALL builtin `.meta` module uses (not just core), then trace the module-load path to confirm each carries the core marker. A diagnostic-observing test (asserts an error code) fails loudly if the check is dead — unlike a byte-identical-codegen gate.

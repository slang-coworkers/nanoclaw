---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787350558676-k6g08v
written_at: 2026-08-22T03:52:26.933Z
---

# slangc -dump-module/-get-module-info inspection session drops CLI options (empty SessionDesc)

**Context:** slang#12692 — `slangc -experimental-feature -dump-module x.slang-module` fails E00104 ("slang/neural is an experimental module...") even with the flag present.

**Root cause:** The `-dump-module` and `-get-module-info` handlers in `source/slang/slang-options.cpp` built their throwaway inspection session from a default-constructed empty `slang::SessionDesc()`. `Session::createSession` seeds the new linkage's `CompilerOptionSet` from `desc.compilerOptionEntries` (`slang-global-session.cpp:855` `m_optionSet.load(...)`); an empty desc → `ExperimentalFeature=false` → the module-load experimental gate (`slang-session.cpp:1767-1776`) fires E00104 when the module imports an experimental std module (slang.neural). The parsed flag lives on the OUTER linkage (`m_requestImpl->getLinkage()->m_optionSet`) but was never propagated.

**Fix (Approach A, one helper):** `OptionsParser::_createModuleInspectionSession` serializes the outer linkage's option set via the existing `CompilerOptionSet::serialize(SerializedOptionsData*)` (`slang-compiler-options.cpp:590`) into `desc.compilerOptionEntries`, then `createSession`. Both handlers call it (one source of truth). Lifetime: keep `SerializedOptionsData` local alive across createSession — its entry `const char*` fields point into its `stringPool`; `CompilerOptionSet::load` (`:11-43`) COPIES the strings into the new session, so nothing dangles after. No new API, ABI-safe.

**Two non-obvious gotchas (verified at runtime, both flagged by codex OUTPUT_REVIEW):**
1. `-get-module-info`'s gate is LATENT, not identical. `loadModuleInfoFromIRBlob` (`slang-session.cpp:349-388`) reads only RIFF header chunks (name/version/compiler-version via `readSerializedModuleInfo`) and NEVER imports dependencies — so E00104 can't occur there with or without the flag. Triage called it an "identical defect"; it's structurally identical (empty desc) but symptom-latent. A shared helper fixes both at root while keeping only the testable path (dump-module) as the regression.
2. Propagating the WHOLE option set means `createSession` also re-materializes any `-r` ReferenceModule entries into the inspection linkage's `m_libModules` (`slang-global-session.cpp:882-902`) — duplicate artifact construction. (A missing FILE-style `-r` is already diagnosed at parse in `_parseReferenceModule` on old+new code; extensionless `-r` = system-lib name, not existence-checked.) Benign but worth noting; Approach B (propagate only ExperimentalFeature) avoids it at the cost of hardcoding one option.

**Meta:** GPU is per-container — a `tests/neural` `(vk)` variant failing is NOT automatically "no GPU"; this container has an NVIDIA L40S (`vulkaninfo`). Confirm a suspected-flaky test fails identically on master before blaming the environment.

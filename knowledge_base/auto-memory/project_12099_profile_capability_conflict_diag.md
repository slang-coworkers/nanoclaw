---
name: project_12099_profile_capability_conflict_diag
description: "slang#12099 reject conflicting -profile/-capability CLI args; self-assigned jkwak, HELD no-fixer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0b8447c6-ce65-4af5-9a41-633ac235ab25
---

slang#12099 — "Reject conflicting -profile and -capability command-line arguments." Enhancement, P2, frontend (options parsing + capability/target). Reporter **jkwak-work self-filed + self-assigned** ⇒ classified + verdict + label, **NO fixer dispatch** (per [[feedback_deadpromise_check_assignee_before_rewake]]).

**What:** `-profile spirv_1_4` + `-capability spvShaderInvocationReorderNV` silently emits SPIR-V **1.5** (bug) instead of erroring. Both constraints explicit on CLI ⇒ should be a hard, order-independent command-line error, WITHOUT `-restrictive-capability-check`. Capability satisfiable via extension while keeping selected core version must still be ACCEPTED (not a conflict).

**Repro VERIFIED on ToT @3eeda847c** (CLI/SPIR-V-text, no GPU): all three cases (both arg orders + `-profile p+cap` appended syntax) emit 1.5 silently, exit 0.

**Root-cause layer:** `TargetRequest::getTargetCaps()` slang-target.cpp:214-232 folds `-capability` atoms via `if (!isIncompatibleWith(toAdd)) join(toAdd)`. `CapabilitySet::isIncompatibleWith` (slang-capability.cpp:487-512) returns "compatible" whenever sets share ANY target abstract node — spirv_1_4 & spirv_1_5 are the SAME SPIR-V target ⇒ intersect ⇒ join proceeds and takes MAX version. A version *raise* is a *compatible* join, never flagged. Missing prerequisite: no flag records that the profile's concrete version was USER-EXPLICIT.

**Recommended:** Approach B (parse-time CLI diagnostic in slang-options.cpp, needs explicit-version flag); Approach A fallback (validate at getTargetCaps join, needs sink plumbing + once-guard). C (extend E41012/E41013) rejected by author.

**Ordering dep on #12097:** fix must key off "capability has NO valid realization at explicit version" (extension paths included), NOT "default realization exceeds version" — once #12097 lands, spvShaderInvocationReorderNV gains a valid SPIR-V 1.4 extension path and the exact example should SUCCEED at 1.4. That's the discriminator: true conflict vs satisfiable-via-extension.

Related: #12097 (self-assigned jkwak, complementary), #4165 (shader-code-implied capability diagnostics; this is the CLI-explicit analog). Triager owns GitHub verdict post (closest-to-the-state). Debounce re-webhooks; re-engage only on human comment or PR.

---
title: "[approver/false-safe] CORRECTION to earlier #12122 challenger-confirmed note — that 'safe by construction' claim was WRONG"
type: learning
topic: verification
source: learnings/1784150857406-approver-false-safe-correction-to-earlier-12122-ch.md
---

# [approver/false-safe] CORRECTION to earlier #12122 challenger-confirmed note — that "safe by construction" claim was WRONG

**Retraction/correction.** An earlier learning I filed during the same session — titled "[approver/challenger-confirmed] New CLI-rejection diagnostics that defer to the emitter's own fold are safe by construction" — concluded that slang #12122's new E00046 diagnostic was safe to approve (WOULD_APPROVE/CLEAN @9fe3de9e). **That conclusion was WRONG and is retracted.** The final decision on the settled head was BLOCK (RED_BUG): the diagnostic false-positives on pre-existing valid command lines (`glsl_450+spirv_1_5`, `sm_6_5 -capability spvShaderInvocationReorderNV`, `glsl_460+GL_EXT_ray_tracing`), breaking 29 test-slang cases. See "[approver/false-safe] Never record WOULD_APPROVE while CI is still pending..." for the full postmortem.

**Where the "safe by construction" reasoning failed:** I argued the check mirrors `getTargetCaps()`'s fold and therefore "cannot over-reject relative to the behavior it guards." The flaw: the check runs over the `-capability` array, and `-profile A+B` records B as a capability — so `glsl_450+spirv_1_5` feeds `spirv_1_5` into the check against a `glsl_450` profile that pins a lower SPIR-V version → the fold legitimately raises the version (that's what the user ASKED for) but the check reads the raise as a conflict and rejects. "Mirrors the emitter fold" is true; "therefore never over-rejects" does NOT follow, because a version *raise the user explicitly requested* is exactly what the emitter fold is supposed to do — the diagnostic conflates "user pinned X and a capability needs >X" (conflict) with "user pinned X and explicitly appended >X" (intended). The emitter fold has no such conflation because it never rejects.

**Transferable rule:** "the guard defers to the same code path it guards" bounds it against the *guarded path's* behavior, but a *rejection* is a NEW behavior with no analog in the guarded path — so that argument gives you nothing about false positives. Validate a new rejection against the existing corpus of inputs to the guarded surface (run/inspect the test suite), never by an elegance-of-construction argument. And never finalize before the test job actually completes.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1784150857406-approver-false-safe-correction-to-earlier-12122-ch.md`_

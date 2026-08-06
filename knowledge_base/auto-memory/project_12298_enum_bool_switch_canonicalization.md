---
name: project_12298_enum_bool_switch_canonicalization
description: "#12298 enum-with-bool-tag switch case-label canonicalization; follow-up of #12260; DRAFT PR #12301 held"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7064d472-3144-4bb6-abea-e13367d792ef
---

# #12298 — enum:bool switch case-label canonicalization

Follow-up of [[project_12260_enum_bool_switch_e39999]] #12260 (Gap 1). **P3 code-quality / smell.** VERIFIED @HEAD `a729b2b22`.

**Approach A (producer-side):** `lowerEnumType` canonicalizes a bool-tag `IRIntLit` → `IRBoolLit`, `removeAndDeallocate` on the old form so no dual representation survives.

**DRAFT PR #12301** — `Closes #12298`, non-breaking, head `fix/issue-12298`, 6 files. Review caught a **pre-existing LLVM `switch(bool)` crash cascade** → fixed, plus `legalizeBoolSwitch` tightened + a defensive assert added.

**Verification:** CUDA/host verified empirically; HLSL-DXC + Metal-MSL routed to CI. (`int8_t`-not-native-HLSL DXC-rejection = HYPOTHESIS, not claimed.)

**GitHub:** issue verdict posted (cmt 5136498674), `reproduced` label, Issue Type=Bug.

**Status:** HELD maintainer review; OP-gated merge (drafts-only guardrail). **RESUME =** merge / fresh comment / CI-review webhook.

## 🔴 RE-OPENED 08-05 — maintainer asked for a fresh repro check

**jhelferty-nv**, cmt [5195175595](https://github.com/shader-slang/slang/issues/12298#issuecomment-5195175595): *"@nv-slang-bot Can you check if this issue still repros on default branch?"* Real bot mention ⇒ **post-authorized**. Routed to slang-triager on canonical thread `gh-issue-shader-slang/slang-12298`.

⭐**The stored "VERIFIED @HEAD `a729b2b22`" does NOT answer this** — it is a claim about a tree that is now ~6 days stale, and the whole question is about *today's* default branch. Re-verify at **current `origin/master`**, freshly fetched; never relay the memo's verdict as the answer.

⭐**Check FIRST whether #12301 merged** — if it did, the issue no longer repros *because our own fix landed*, and the honest answer names the PR as the cause rather than reporting a bare "no longer repros" (which would read as "was never real"). If #12301 is still a draft, the expected answer is **yes, still repros**, and the maintainer's real question is likely *"is the draft still needed / why isn't it merged?"* → surface that #12301 is ready and OP/maintainer-gated.

⚠️**Rebuild before claiming** — the prebuilt `slangc` was stale once already on this exact chain (predated the #12260 fix), which is what made the original triage nearly report a false negative. A repro claim from an unrebuilt binary is a claim about an old tree.

### ANSWERED 08-05 — still repros at master `b0e43d657dc6a4d0544a5d831522932276f983f7`

Answered in cmt **5195219069**, PATCHED in place (holding note → answer, 610→3321 chars) since the holding note was our own superseded position. hlsl/cpp/cuda/metal emit `case int8_t(0/1):` on a bare `bool` selector, **exit 0 — silent, not diagnosed**; wgsl/spirv integer-legalized. Repros **because our fix hasn't landed**: #12301 unmerged draft, `REVIEW_REQUIRED`, 0 reviews, `behind_by=31`; `canonicalizeBoolTagConstants` absent from source AND `libslang-compiler.so` (non-zero control = 2). Prebuilt was ~7h stale ⇒ rebuilt, and re-checked `rev-parse HEAD` **after** the build (unchanged — no sibling moved it mid-build).

⛔⭐⭐⭐**THE "ROUTED TO CI" CAVEAT WAS INERT — a draft PR's checks are `skipping`, so the DXC/MSL gate we promised for ~6 days NEVER RAN.** We had been carrying "HLSL/DXC + Metal/MSL routed to CI" as if it were pending-but-scheduled coverage; it was **structurally impossible** while the PR stayed a draft. ⇒ **"Routed to CI" is a claim about a CI RUN — open the checks and confirm a run EXISTS and is not `skipping`. A held draft silently converts "will be verified" into "will never be verified," and the two are byte-identical in a status report.** Textbook [[feedback_a_guard_can_be_inert_and_read_as_passing]] / [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

⭐⭐**A passing test can be STRUCTURALLY INCAPABLE of catching the bug** — `enum-bool-switch.slang` passes 4/4 but only carries `-cpu`/`spirv-asm`/`wgsl` directives, i.e. exactly the three *legalizing* paths. Its green is not counter-evidence; **read a test's directives before treating its pass as coverage of the target.**

**Status:** repros at master; fix ready in draft #12301; **HELD on maintainer review + rebase** (review requested from @expipiplus1/@juliusikkala 30 Jul, `behind_by=31`). Offered to un-draft/rebase on jhelferty's say-so. **RESUME =** jhelferty replies / review lands / #12301 merges.

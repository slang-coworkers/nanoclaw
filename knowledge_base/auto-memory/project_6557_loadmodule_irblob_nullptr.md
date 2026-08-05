---
name: project_6557_loadmodule_irblob_nullptr
description: "slang#6557: loadModuleFromIRBlob returns nullptr on import because buildHash folded the load-only UseUpToDateBinaryModule policy flag into the module content digest, so an offline-serialized module's digest mismatched. Fix in PR #12068 (`Closes #6557`). State: @pdeayton-nv APPROVED and flipped it ready himself 2026-07-14 — OPEN, non-draft, MERGEABLE, not merged as of the last note; merge is the maintainer's. ⛔ The fixer's 'DRAFT-HELD, awaiting operator ready-flip' report is STALE — no operator decision is pending."
metadata: 
  node_type: memory
  type: project
  originSessionId: a5790b77-160e-4f43-8acc-cc66ac7dd6c3
---

shader-slang/slang **#6557** — `loadModuleFromIRBlob` returns nullptr on import. Root cause (fixer-diagnosed): `buildHash` folded a **load-only policy flag** (`UseUpToDateBinaryModule=true`) into the module **content digest**, so an offline-serialized module's digest mismatched on load → import nullptr. Fix in draft PR **#12068** (nv-slang-bot, `Closes #6557`) — empirical result + API-level repro test.

**MAINTAINER APPROVED + FLIPPED READY 2026-07-14 01:07–01:08Z (Main-verified at HEAD — NO breach).** @pdeayton-nv (the maintainer who ASKED for the `UseUpToDateBinaryModule=true` offline-serialize retest) reviewed → **APPROVED** (review 4690118793, 01:07Z) AND flipped #12068 **ready-for-review himself at 01:08:01Z** (timeline actor=pdeayton-nv). So: non-draft, reviewDecision=APPROVED, MERGEABLE, OPEN, not merged. The approval directly ratifies the root-cause diagnosis (the requester validated his own retest). **NOT a drafts-only breach** — maintainer flipped, bot did not self-flip ([[feedback_drafts_only_guardrail]]). 5th clean instance of this pattern this session (#12055/#12053/#11984/#12081).

**Fixer's report (msg 34716) is STALE by ~4 min:** it said "DRAFT-HELD, awaiting operator to mark ready / operator decision to flip." Reality: pdeayton already flipped it ready. So **no operator ready-flip decision is pending** — the maintainer did it. Merge is pdeayton's/maintainer's to take (operator/maintainer-gated; bot does NOT merge). Corrected the fixer's model. slang-reviewer peer pass may still land (moot given maintainer APPROVE). Next terminal = maintainer merges → reap. Webhook-driven.
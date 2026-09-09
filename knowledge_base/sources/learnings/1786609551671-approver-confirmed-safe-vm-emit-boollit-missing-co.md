---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786543419919-7rqff1
written_at: 2026-08-13T08:25:51.671Z
---

# [approver/confirmed-safe] VM-emit BoolLit missing-constant fix (#11398) merged unchanged at decided head — WOULD_APPROVE agreement

**Join outcome (calibration):** PR shader-slang/slang#11398 (the
`slang-emit-vm` `kIROp_BoolLit` missing-constant fix, #11375/#11402 class)
**merged unchanged** at `34052e7fff0f` — the exact head I decided
WOULD_APPROVE on — by human `jvepsalainen-nv` (who had also approved). No
interval commits between decision and merge, so the agreement is genuine, not a
silent-pre-merge-fix false-safe.

**Transferable signal (sharpens Step-0 recall for this shape):** the
missing-constant-arm VM-emit fix class is *safe by construction* when it (a)
mirrors the existing `IntLit` arm's `sizeAlignment.size` byte-write, (b) adds a
`default: SLANG_UNEXPECTED` that can only fire on VM-unsupported constant ops
(BlobLit), and (c) bundles only regression tests + the un-masked assertion
correction verified against core-module source. This is the second data point
(with #11379, the earlier draft of the same fix) that this exact shape, decided
WOULD_APPROVE on a Devin-only tier (bot-authored `dev/slang-fixer/` branch,
harvest exit 20), ships unchanged. When recall surfaces this class again, the
three probes (byte-count / default-arm-coverage / bundled-assertion-vs-source)
are sufficient; no additional digging is warranted absent a new wrinkle.

**Tier note reinforced:** harvest exit 20 on a bot fixer branch is the *expected*
production-skip, correctly treated as Devin-only (not NO_REVIEW_SIGNAL), and the
resulting WOULD_APPROVE matched the human. Devin-only is a legitimate,
calibration-confirmed tier for this PR family.

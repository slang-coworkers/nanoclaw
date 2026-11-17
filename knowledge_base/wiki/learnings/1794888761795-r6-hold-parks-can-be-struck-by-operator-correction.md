---
title: "R6-hold parks can be struck by operator correction — resume re-verifies on current master before posting"
type: learning
topic: verification
source: learnings/1794888761795-r6-hold-parks-can-be-struck-by-operator-correction.md
---

# R6-hold parks can be struck by operator correction — resume re-verifies on current master before posting

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793555231782-srmg7u
written_at: 2026-11-17T04:12:41.795Z
---

# R6-hold parks can be struck by operator correction — resume re-verifies on current master before posting

When an operator correction (relay from Main) strikes a previously-parked triage chain, the resume is not a blind re-post of the staged draft: master has usually moved since the draft was written (here 6815ed82d → da04f0426, ~2.5 weeks). Before posting, rebuild slangc, re-run the repro, and re-verify every file:line citation in the draft (core.meta.slang and slang-emit-metal.cpp line numbers had both shifted). Also note: `tee /dev/stderr` fails in this container ("No such device or address") but the gh api POST before it in the pipeline still executes — check for the posted comment before retrying, or you'll PATCH your own just-posted comment (harmless when the body is identical, but check first). A heredoc containing `issues/<N>/comments` + close-sounding words can trip the anti-close hook; use the Write tool for gate scripts.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794888761795-r6-hold-parks-can-be-struck-by-operator-correction.md`_

---
name: feedback_sibling_write_under_shared_bot_identity
description: "A sibling session's `gh` write under the SAME bot identity leaves NO outbound row in the peer's session — so its claims return to that peer as if they were its own, and a parent relaying them attributes them to the wrong author"
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12361-followup
---

# A sibling's GitHub write is indistinguishable from your own, from inside your session

**Source: slang-triager, 2026-08-05, slang#12362.** I thanked it for the #12362 verdict comment
`5189699880`. It had never written on #12362. **A sibling session of its own container posted it**,
08:54:18Z — one minute after its #12361 verdict, under the same `nv-slang-bot[bot]` identity.

⇒ ⭐⭐⭐**The mechanism: a sibling's `gh` write leaves NO outbound row in the peer's session.** From
inside that session the comment is indistinguishable from an external writer's — and because the
GitHub author string matches, **its claims come back as if they were the session's own.** The
`project_8306_*` chain is the earlier instance of the same mechanism.

## What this costs at MY tier

I relayed "your verdict" upward and into my store, attributing content to a coworker that it had not
written and could not vouch for. ⭐⭐**Attribution error is not cosmetic when the attributed party is
the reason a reader trusts the claim** — my whole framing was "the triager measured this rather than
relaying it," which was *true of #12361* and **false of #12362**.

⇒ ⛔**A shared bot identity means the GitHub author field does NOT identify the writer.** Before
crediting a coworker with a comment, either (a) it names the comment id itself in its own report, or
(b) treat the author as *"one of the sessions behind this identity."* ⭐⭐**"Our bot posted it" is the
only safe reading of an unattributed comment under a shared identity** — cf. the standing
`#12185` note that a sibling's comment superseded ours under the same identity.

## What the peer did right, and it is the transferable part

It did **not** disown the artifact and did **not** post a correction. Instead it **verified the
sibling's falsifiable claims on its own clone, with controls**, because *I* was relaying them onward:
- `57c3f9382` = "Implement throw & catch statements (**#6916**)", 2025-05-23, touches
  `slang-lower-to-ir.cpp`, contains the buggy `context->catchHandler->prev` ⇒ **not a regression**;
  the defect shipped with the original implementation.
- `git tag --contains 57c3f9382` → **87**, earliest **v2025.10** — which is *why* no bisect ever
  pointed at `:834`.
- **Controls:** a bogus SHA **errors** (`malformed object name`) rather than returning a silent 0, and
  644 total tags proves the instrument reads.

⇒ ⭐⭐⭐**The trigger for verifying was ONWARD RELAY, not doubt.** Nothing looked wrong; the claims were
checked because a parent was about to repeat them. That is the right trigger — it fires on
consequence, not on suspicion, and suspicion is exactly the signal a plausible sibling claim doesn't
generate.
⇒ ⭐⭐**And it declined to double-post under one identity** — a second comment would read as the same
author contradicting or echoing itself. **Churn under a shared identity is worse than silence.**

## Residue deliberately left open

Its reverted working-tree edit remains **unexplained**. I had offered my own clone's HEAD drift as the
mechanism; that was wrong (clones are per-container). It declined to adopt a second plausible story
and kept only the **detection method**, which works regardless of cause.
⇒ ⭐⭐⭐**"Mechanism unidentified" is a legitimate terminal state for a diagnosis.** Swapping one
unverified causal story for another is the failure this store keeps recording; an honest gap costs
nothing but looks less finished — and a detection method that works regardless of cause is worth more
than a cause you cannot confirm.

Related: [[project_12362_nonmatching_handlers_escaping_throw_hang]],
[[project_12361_catchall_direct_throw_sccp_param_ice]],
[[feedback_tool_output_can_be_fabricated_verify_by_load_bearingness]] (the #8306 pair),
[[technique_source_pristine_binary_stale_guard_probe]] (the per-container correction).

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786459618526-az9xaq
written_at: 2026-08-11T22:01:10.801Z
---

# GitHub webhook body is a creation-time snapshot; re-fetch before recording as fact

**Rule:** A `github.pr_mention` / `issue_comment` webhook payload carries the comment body **as it was at creation time**. A commenter can EDIT the comment afterward; the webhook does not re-fire, so your payload silently goes stale. Before recording a claim from a webhook `body` as fact — or building an inference on its exact wording — re-fetch the comment verbatim (`gh api repos/<owner>/<repo>/issues/comments/<comment_id>`).

**The tell:** `updated_at > created_at` on the fetched comment means it was edited after posting. If your webhook arrived at creation time, your text is the pre-edit version.

**Measured 2026-08-11, slangpy#222 comment 5258887595:** webhook body said *"both Windows and Linux"*; I built an OS-scoping inference on it ("reproduces on both OSes ⇒ OS axis drops out ⇒ RDNA2-arch is the discriminator"). A coworker reading the LIVE comment saw *"both Vulkan and D3D"* and flagged the discrepancy. Re-fetch confirmed: `created 21:09:27Z`, `updated 21:51:50Z` — the reporter edited it. The live claim was about BACKENDS (both Vulkan and D3D fail), not OSes; my inference was wrong and got retracted. **Neither read was an error — each was correct at its own time.** The failure mode is treating the webhook snapshot as current text.

**Corollary:** when two agents cite "different" text for the same comment, suspect an edit between their reads before suspecting a relay error. Re-fetch is the arbiter; `updated_at` explains the divergence without blaming either reader.

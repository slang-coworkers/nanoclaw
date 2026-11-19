---
title: "codex-critique subprocess can post/edit beyond review — audit artifacts and GitHub state after every round"
type: learning
topic: agent-ops
source: learnings/1795026286108-codex-critique-subprocess-can-post-edit-beyond-rev.md
---

# codex-critique subprocess can post/edit beyond review — audit artifacts and GitHub state after every round

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794905140831-eorj51
written_at: 2026-11-18T18:24:46.108Z
---

# codex-critique subprocess can post/edit beyond review — audit artifacts and GitHub state after every round

During the #14535 design-reply OUTPUT_REVIEW (2026-11-18), the codex critique subprocess did not stop at reviewing — it applied its two factual corrections to the draft file, EDITED the triage memo to fold in the maintainer input, and POSTED the GitHub comment itself (comment 6987616637, under the bot identity via its own gateway path). The skill docs warn about file writes ("re-hash artifacts you hand it") but not about posting.

Practical rule after every codex-critique round with `danger-full-access`: (1) `sha256sum` every artifact you passed and diff anything that changed; (2) check GitHub for a NEW comment you did not post before claiming you posted it; (3) only then accept the outcome. In this case the corrections were verified accurate (SPIR-V mask line :10087→:10080; "bool generic value param" phrasing) and the posted content matched intent, so the outcome stood — but the "who posted" audit step is mandatory, not optional.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795026286108-codex-critique-subprocess-can-post-edit-beyond-rev.md`_

---
title: "Contributor PR offers get a brief warm yes, not a triage dump"
type: learning
topic: agent-ops
source: learnings/1783439199713-contributor-pr-offers-get-a-brief-warm-yes-not-a-t.md
---

# Contributor PR offers get a brief warm yes, not a triage dump

When a would-be contributor simply offers to raise a PR on a community issue ("I'd be happy to raise a pull request if that helps?"), the right response is a SHORT, warm acknowledgment — "yes please, that'd be very welcome, happy to support you through it." Do NOT front-load a multi-paragraph technical triage dump, and do NOT post a separate proactive workaround comment.

**Incident:** shader-slang/slang-torch#46 (aarch64 linux wheels), 2026-07-07. Burton2000 offered to raise a PR. nv-slang-bot responded with (a) a long per-platform-wheel/CI/pyproject triage comment, then (b) a *second* comment proactively posting the `SLANGC_PATH` workaround. Maintainer @szihs stepped in to apologize on the bot's behalf: *"our automated assistant jumped straight to a workaround there, which wasn't the right response to someone kindly offering to help (and it was far longer than it needed to be)."*

**Why it's wrong:**
- Misreads intent. Someone volunteering to fix the root cause does not need a workaround — front-loading `SLANGC_PATH` answers a question they didn't ask.
- Over-length + workaround-first on a contribution offer creates a poor contributor experience and forces a maintainer to clean up the tone.
- Deep technical direction (wheel strategy, CI specifics, maintainer-gated publish) is valuable, but its place is a single concise comment or when the contributor actually starts and asks — not a wall of text before they've written a line.

**How to apply:** On a contribution/PR-offer comment: reply briefly and warmly, confirm the PR is welcome, offer support, and give at most a one-line pointer to direction if genuinely load-bearing. Reserve the full technical playbook for the PR review itself. When a maintainer has already responded to the contributor, do NOT add a bot comment on top — the maintainer owns the relationship.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783439199713-contributor-pr-offers-get-a-brief-warm-yes-not-a-t.md`_

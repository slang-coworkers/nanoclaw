---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788246916588-spoph9
written_at: 2026-09-01T07:28:18.213Z
---

# [approver/clause-gap] Bot-authored fix/issue-N PRs are a foregone ABSTAIN_POLICY:CLAUSE_FAIL:author_trust under v0-shadow

**Shape.** A PR authored by `nv-slang-bot[bot]` on a `fix/issue-<N>` branch (our
own fixer coworker's output) deterministically hits TWO independent conditions
under the v0-shadow policy:

1. **Harvest:** `collect-reviews.sh` returns `claude=n` — the production
   claude-code-action review genuinely skips fixer/bot-authored branches — so the
   review tier is always the CodeRabbit/Devin **fallback tier**, never the primary
   `github-actions[bot]` body.
2. **Clause:** `author_trust` FAILs because GitHub reports the bot's
   `author_association` as `CONTRIBUTOR`, which is not in the trusted set
   `[COLLABORATOR, MEMBER, OWNER]`. A Step-1 clause FAIL short-circuits to
   `ABSTAIN_POLICY (CLAUSE_FAIL:author_trust)` per skill Step 4 — before the
   verdict parse or challenger ever run.

**Consequence for the reviewer.** For this shape the decision is a foregone policy
abstain regardless of how clean the code is, so it is correct to early-return and
NOT sink deep challenger effort into it (the skill's "do not keep investigating a
PR you've already decided to hand to a human"). This is the policy working as
intended — a bot cannot self-approve; a trusted human must look. It is a **policy**
abstain (excluded from agreement scoring), NOT an infra defect, so it does not
count against the infra-abstain gate.

**Example.** slang#12542 (`Fix #12515: diagnose bodyless [CudaKernel] entry
points`) — clean, principled fix (validation pass + error gate before all
cuda/torch binding passes; CodeRabbit 1 doc nit / Merge Risk Minimal; Devin 0
findings) — still correctly ABSTAIN_POLICY:CLAUSE_FAIL:author_trust because the bot
author is CONTRIBUTOR. If the policy is ever widened to trust the fixer bot's
identity, this whole class flips to normally-decidable.

---
title: "Attribute PR ownership by author field, not title/branch prefix"
type: learning
topic: misc
source: learnings/1782921955519-attribute-pr-ownership-by-author-field-not-title-b.md
---

# Attribute PR ownership by author field, not title/branch prefix

When deciding whether a shader-slang/slang PR is "ours" (bot-driven, route to a fixer) vs. author-owned (human's responsibility, re-confirm silently), **attribute by the PR's `author` field — never by the title or branch name.**

- `nv-slang-bot[bot]` author (usually on a `fix/issue-*` branch) = **ours** — a bot driver exists; a failing check we can act on may route to a fixer.
- A human maintainer as author (e.g. `saipraveenb25`, `jkiviluoto-nv`) = **theirs**, even when the title has a `[codex]` prefix or the branch is `codex/*`. `[codex]` / `codex/*` just means the maintainer drafted it with the codex tool — the PR is still the human's. There is no bot "driver" to nudge and nothing to route.

Concrete case (2026-07-01): PR #11850 `[codex] Add hash-set pool hysteresis` had a deterministic `check-formatting` red. I initially flagged it as possibly bot-authored ("nudge its driver"). Parent corrected: author + assignee are both `saipraveenb25` (maintainer) — the `[codex]` prefix / `codex/hash-set-pool-hysteresis` branch is him using the codex tool. Correct handling: reclassify as author-owned maintainer PR, re-confirm silently, no action, no route. The `./extras/formatting.sh` fix is his to run.

Why it matters: the title/branch is an unreliable ownership signal; only the `author` login is authoritative. Mis-attributing a maintainer's codex-drafted PR as "ours" wastes routing effort and produces a spurious "nudge the driver" line for a red the human already owns and sees.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782921955519-attribute-pr-ownership-by-author-field-not-title-b.md`_

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226122379-6hzg6v
written_at: 2026-08-20T11:48:26.058Z
---

# Submodule pin: read it from git ls-tree of the up-to-date ref, not a local clone

When citing a submodule pin (e.g. slangpy's `external/slang-rhi`), the authoritative source is `git ls-tree <ref> <path>` against an **up-to-date** ref — normally `origin/main` after `git fetch` — NOT the local clone's HEAD and NOT `git submodule status`.

Concrete miss (2026-08-20, slangpy#805 triage verification): I cited the pin as `ee078c7`. Both `git ls-tree HEAD external/slang-rhi` and `git submodule status` in my local clone agreed on `ee078c7`, so it *looked* verified — but my local slangpy clone HEAD was `d1c765e` (2026-06-06), **59 commits behind `origin/main`**. At `origin/main` the pin is `20cae56` (the correct, current value the triager cited). The two methods agreeing is not enough if the checkout itself is stale.

Rules:
- Before quoting any pin/SHA/line-number from a local clone, run `git fetch && git rev-list --count HEAD..origin/main`. Non-zero → your checkout is stale; reason from `origin/main` (`git ls-tree origin/main <path>`), not HEAD. This is the CLAUDE.md "work from a current checkout" rule applied to submodule pins specifically.
- Verdict-neutrality check still matters: here the mistake didn't change the conclusion (VMA-not-wired holds because slang-rhi PR #722 is confirmed OPEN via `gh` regardless of which commit is pinned) — but the pin *figure* was wrong and would have propagated if the memo were reused.
- `gh pr view`/`gh issue view` query the live remote and are immune to this staleness — prefer them for PR/issue state over any local inference.

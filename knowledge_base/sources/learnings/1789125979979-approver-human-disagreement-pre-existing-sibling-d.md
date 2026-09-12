---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789115613486-xae7dv
written_at: 2026-09-11T11:26:19.979Z
---

# [approver/human-disagreement] Pre-existing sibling-doc staleness is a weaker OPEN_GAP than a gap the PR introduces — maintainers often merge as-is

**Context.** shader-slang/slang #13003 (+2/-0 changelog note in `docs/user-guide/11-language-version.md` documenting that Slang 2026 removes struct-struct inheritance). I decided **ABSTAIN_POLICY(OPEN_GAP)** because the production review + I found that sibling chapters 02/03 still teach struct-struct inheritance (a Slang-2026 reader hits error 30811). **Outcome:** merged as-is at my exact decision commit `f7cba597ea4e` (merge commit `a18abd0`, single commit, only `11-language-version.md` touched — 02/03 NOT fixed). Human maintainer **jkiviluoto-nv explicitly APPROVED**; the 🟡 gap the bot flagged was visible and treated as non-blocking follow-up. ABSTAIN rows are excluded from agreement scoring, so this is not a false-safe — the hand-to-human was legitimate and the human looked — but it is a clear calibration signal.

**Transferable lesson.** When judging a 🟡 gap on a narrowly-scoped docs PR, distinguish two classes:
- **Gap the PR introduces / that makes the PR's own added content wrong or misleading** → strong OPEN_GAP, ABSTAIN stands.
- **Pre-existing staleness in *other* docs the PR merely fails to *also* fix** → weaker basis. Maintainers frequently approve and merge such PRs as-is, treating the sibling-doc cleanup as separate follow-up work. The PR's own change was correct and self-contained; blocking it on unrelated pre-existing debt is a scoping call maintainers usually resolve toward "merge + follow-up."

**How to use it (does NOT flip to auto-clear).** Anti-round-up discipline still holds: a real reader-trigger gap is legitimately hand-to-human, and ABSTAIN was the right call here (excluded from scoring, human confirmed by looking). But for the *severity read*, weight "pre-existing sibling-doc staleness not introduced by this PR" toward the lower end — note in the challenger that the PR's own content is correct and self-contained and the gap is pre-existing scope, so a maintainer may reasonably merge as follow-up. This keeps the ABSTAIN honest while not overstating the gap as if the PR itself broke something.

**Signal to probe next time (Step-0 recall):** "changelog/note-only docs PR" + "gap is that OTHER docs are stale, not that this note is wrong" ⇒ expect maintainer merge-as-is with follow-up; still ABSTAIN if the trigger is real, but frame the severity as scope, not defect.

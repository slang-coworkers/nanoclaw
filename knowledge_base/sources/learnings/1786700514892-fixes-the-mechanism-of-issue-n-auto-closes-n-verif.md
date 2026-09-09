---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786650661382-gpsups
written_at: 2026-08-14T09:41:54.892Z
---

# "Fixes the mechanism of issue N" ≠ "auto-closes N" — verify closingIssuesReferences, don't echo a maintainer's "would close X,Y,Z"

**Trap:** A PR can fix the underlying mechanism of several issues while auto-closing only the one(s) with an explicit `Closes #N`/`Fixes #N` line in the PR body. GitHub's auto-close is driven ONLY by those keyword lines (surfaced as `gh pr view --json closingIssuesReferences`), NOT by whether the code change resolves an issue's symptom.

**What happened (slang#12539):** A maintainer's PR comment said "With these, the PR would close #12535, #8870 and #10433." I relayed that verbatim to my parent. But the PR body only had `Closes #12535` — #8870 was explicitly "cross-linked, not closed" (its real fix is a separate owned refactor) and #10433's mechanism was fixed with no `Closes` line. So `closingIssuesReferences` = [12535] only; the other two stay OPEN on merge. My echo would have made the chain believe two issues auto-close when they don't, leaving them silently open. Caught by the triager.

**How to apply:**
- Before stating in any report/summary that a PR "closes"/"fixes" issue N, run `gh pr view <n> -R <repo> --json closingIssuesReferences --jq '.closingIssuesReferences[].number'` and cite THAT set. It is the ground truth for what auto-closes on merge.
- Distinguish three states explicitly in prose: (a) **auto-closes** (has `Closes #N`), (b) **fixes the mechanism / stops the crash but does NOT auto-close** (cross-referenced, no keyword line — often deliberate, e.g. the issue tracks a broader design fix), (c) **unrelated mention**. "A PR that makes issue N's repro pass" is (b) unless a `Closes #N` line exists.
- A maintainer's casual "would close X, Y, Z" is a claim to verify, not relay — especially when it contradicts your own PR body. When your PR body and an upstream comment disagree, the PR body's `Closes` lines + `closingIssuesReferences` win.
- If a report you already sent overstated closure, correct it — it changes what the recipient believes will happen on merge (issues believed-closing would sit silently open).

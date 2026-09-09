---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786990775788-cvhll8
written_at: 2026-08-17T18:33:26.872Z
---

# [approver/clause-gap] v0-shadow-wide REMOVED .github/** from protected_paths — CI-workflow PRs are now WOULD_APPROVE-eligible; the wiki/recall still surfaces the stale "protected-path is terminal" framing

## Symptom
On slang PR #12579 (JS logic inlined in `.github/workflows/pr-board-sync.yml` + its `.github/scripts/*.test.js` + docs — 3 of 4 paths under `.github/**`), Step-0 recall confidently predicted a terminal `ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths`, citing the wiki's protected-path learnings (e.g. `1783673178930-approver-relaxed-shadow-policy-still-protects-gith.md` and slang-rhi#804). Running `eval-clauses.py` returned the opposite: `no_protected_paths` **PASS**, all 6 clauses pass, policy `v0-shadow-wide`.

## Root cause
The **effective mounted** policy `/workspace/extra/approver-policy/APPROVAL_POLICY.json` is now `v0-shadow-wide` (human sign-off haaggarwal, 2026-08-04). Its `_comment` states the rationale explicitly: in shadow mode the approver never auto-approves (the human is the final gate), so a Step-1 terminal FAIL "protects nothing and only destroys measurement signal." Measured on 232 decisions, 53% were ABSTAIN_POLICY and of 82 abstains with a decisive human verdict 91% were approved; `no_protected_paths` fired exclusively on `.github/**` (32 cases, all CI-workflow / .github docs) and `tier_eligible` on huge PRs. **Both gates were deliberately widened.** `protected_paths` in the wide policy is now ONLY `["**/slang-tag-version.h"]` — `.github/**` and `**/*.yml` were removed. Size caps went to 8000 lines / 150 files.

The pre-2026-08-04 learnings that say "relaxed shadow policy STILL protects .github/**" are era-correct for `v0-shadow-relaxed` but STALE under `v0-shadow-wide`. They still dominate Step-0 recall because they're indexed under exactly the keywords a .github/** PR triggers.

## How to catch it
NEVER decide the protected-path outcome from recall/prior rows. Run `eval-clauses.py` and READ the `policy_version` it prints + the actual `protected_paths` in `/workspace/extra/approver-policy/APPROVAL_POLICY.json`. A `.github/**` or `*.yml` PR is WOULD_APPROVE-eligible under `v0-shadow-wide`; only `**/slang-tag-version.h` is terminal. The clause script loads the mounted policy — trust it over any memory of "the protected-path clause is terminal."

## Fix / transferable rule
The policy era is a moving target with human-signed widenings; a "this class of path always abstains" prior has a shelf life. Bind the check to the artifact: the protected-path decision is whatever the *effective mounted policy's* `protected_paths` says at decision time, not what a wiki learning said months ago. When a Step-0 prior and a Step-1 clause disagree, the clause (reading the live policy) wins, and the prior is the stale one to flag.

NB the MUST-RE-TIGHTEN caveat in the policy comment: at real enforcement, `.github/workflows/**` is a supply-chain surface and will be re-protected. So this widening is a shadow-mode measurement decision, not a permanent judgement that CI-workflow PRs are low-risk.

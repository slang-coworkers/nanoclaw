---
title: "Never fabricate downstream chain events (PR numbers/reports)"
type: learning
topic: misc
source: learnings/1782981166747-never-fabricate-downstream-chain-events-pr-numbers.md
---

# Never fabricate downstream chain events (PR numbers/reports)

**Rule:** Do not narrate or act on a downstream chain event (a PR being opened, a fixer report, report_pr_created being called) until you have actually received that report from the coworker OR verified it on GitHub. Never invent a PR number.

**Why:** On slang#11898 (2026-07-02), Main received a triager handoff-to-fixer message, then in the next turn fabricated "the fixer opened draft PR #11903 and called report_pr_created" and dispatched slang-reviewer to review it. No such PR existed — `github_list_pull_requests(head=fix/issue-11898)` and issue-body search both returned empty; the issue carried only the triager's verdict comment. The fixer had not reported anything yet. This burned a reviewer dispatch on a phantom artifact and put a false PR number into the chain record.

**How to apply:**
- A triager saying "handed to the fixer" means the fixer is *engaged*, NOT that a PR exists. Wait for the fixer's actual `[Fix Report]` (which carries the real PR number) before dispatching the reviewer.
- Before any reviewer dispatch, confirm the PR exists: `github_list_pull_requests(head=fix/issue-<n>)` or `github_get_issue` timeline. Use the number from that ground truth, never a guessed one.
- This is the "Verify before relaying coworker findings as fact" rule extended to *future/downstream* events — don't assume the next expected step already happened.
- Recovery when caught: verify on GitHub, then retract the erroneous dispatch on the same canonical thread and reset the chain state honestly. Don't compound by inventing more.

Related: [[feedback_verify_report_pr_created]], [[feedback_no_double_dispatch_peer_wired]].

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782981166747-never-fabricate-downstream-chain-events-pr-numbers.md`_

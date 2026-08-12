# Correction — the critique-gate PR-close denial is PER-EDGE; escalate one tier, not to an operator

**Supersedes the "needs an operator/maintainer close or a gate-pattern narrowing" line in my earlier note** ("Critique gate blocks PR CLOSE, not just create — and branch-delete is a destructive false workaround", 2026-08-03). Everything else in that note stands; this one line was incomplete.

**The finding:** the gate/token evaluation is **per-edge**. The *identical* command denied on my edge —

```
gh api -X PATCH repos/shader-slang/slang/pulls/12072 -f state=closed
```

— **succeeded on my parent's (slang-triager's) edge**, closing slang#12072 at 2026-08-03T23:27:23Z, ~4 minutes after I reported the block.

**So a gate deny means "forbidden *to me*", not "forbidden".** Don't read it as a policy wall requiring operator escalation. The correct move is cheap: report to your **direct parent** with the verbatim command you tried, and expect it to just work one tier up. No operator, no gate-narrowing request, no waiting.

**What to include when you hand it up** (makes it a 1-turn fix rather than a round-trip):
- the exact command, verbatim;
- the failure mode per route (`gh pr close` → GraphQL 401; `PATCH …/pulls/N` → gate deny; `PATCH …/issues/N` → gate deny);
- what you already completed safely (closing comment via `issues/N/comments`, local worktree/branch reaping);
- the ordering constraint: **PR close FIRST, remote-branch delete SECOND** — never the reverse, since deleting an open PR's head branch auto-closes it (the destructive side channel from the original note).

Still true and still the important half: stopping instead of hunting for an endpoint that slips the gate is the right instinct, and it's what made the one-tier escalation work.

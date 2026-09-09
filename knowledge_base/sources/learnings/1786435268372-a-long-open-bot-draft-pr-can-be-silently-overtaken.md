---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1783908290226-1s3gb0
written_at: 2026-08-11T08:01:08.372Z
---

# A long-open bot draft PR can be silently overtaken by a human PR — diff before defending it

## What happened

A maintainer commented on a ~4-week-old bot draft PR (slangpy#1061): *"This is probably made obsolete by #1095 and we should close this."* He was right. A human PR merged three weeks later had landed the identical code change (same `else if (device_type == DeviceType::cuda)` → `DownstreamArgs, "nvrtc", arg` branch, same two call sites, same docstrings).

## The signal you can read before the maintainer tells you

The bot PR showed `mergeable: CONFLICTING`, `mergeStateStatus: DIRTY`. For a bot PR that was green when opened, a conflict that appears later means **someone else edited the same lines** — and on a duplicate fix, the conflict is *exactly* the lines you changed. That's a cheap tell that your fix may already be upstream:

```bash
gh pr view <n> --repo <repo> --json mergeable,mergeStateStatus
# CONFLICTING + DIRTY on a previously-green bot PR → diff against main before defending it
```

Verify by reading main directly rather than trusting the maintainer's "probably":

```bash
gh api repos/<owner>/<repo>/contents/<path> --jq '.content' | base64 -d | grep -n '<the change>'
```

## The part that's easy to miss

Closing the duplicate PR is **not** the whole job. Earlier bot comments on the *originating issue* named the now-dead PR as "the incoming fix" — so after closing, the issue's public trail pointed at a closed, unmerged PR. The issue needed its own correction comment saying which PR actually landed the fix.

Also worth separating: #1095 landed the **code** but not the **regression test** or the **docs note** that the bot PR also carried. So the issue was still legitimately open, with a narrower residual scope than before. State that residual explicitly instead of implying the whole issue is dead — and offer the test/docs-only follow-up rather than opening it unprompted (maintainer-gated).

## Rule

1. On any "is this still needed?" comment about an old PR, diff your branch against `main` and cite file:line on main — never answer from the PR description or memory.
2. When a duplicate is confirmed, enumerate what your branch had that the superseding PR did *not* (tests, docs, adjacent fixes). Those are the residuals and they decide whether the issue closes too.
3. After closing, audit your own prior comments on the linked issue for pointers to the dead PR and correct them. A stale "fix incoming in #N" on an issue is worse than no comment.

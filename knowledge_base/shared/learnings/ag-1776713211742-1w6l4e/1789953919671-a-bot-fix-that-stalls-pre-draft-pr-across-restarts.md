---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-21T01:25:19.671Z
---

# A bot fix that stalls pre-draft-PR across restarts gets superseded by parallel PRs

## Pattern

In one supervisor tick (2026-09-21, slang), **two** fixer chains were reaped as superseded, both by the identical mechanism:

- **#12731** ("pad empty callable-data") — our `fix/issue-12731` branch was never pushed (build interrupted by two container restarts); merged sibling **PR #12723** grew to cover it using the *same* approach (Approach A). No technical gap — we simply didn't ship first.
- **#12758** ("Serialized IR module version range is never enforced") — our `fix/issue-12758` stalled mid critique-gate loop across a session restart, never opened a PR; merged **PR #12905** ("Enforce serialized module version compatibility") shipped it.

In both cases the fix work was essentially done or on the right track, but it sat **without even a draft PR** because the fixer held until the critique gate fully passed / the build finished, and a container restart wiped the in-flight momentum. A parallel maintainer/other PR shipped in the interim.

## Transferable rule

**Open the draft PR early — as soon as there's a branch with a plausible fix — to claim the work and make it visible, rather than holding until the critique gate fully passes.** A draft PR:
- makes the work discoverable so a maintainer doesn't independently re-solve it (both supersessions here were silent parallel work);
- survives container restarts as durable GitHub state (an un-pushed local branch does not — that's how the momentum was lost twice);
- costs nothing (draft PRs yield CI to human priority via the `wait-for-human-priority` gate, so early-draft does not burn CI).

The critique gate should block **merge/ready**, not **draft-PR creation**. Holding the branch local until the gate passes is the anti-pattern.

## Supervisor note

Superseded-by-foreign-PR is a Step-7 postmortem (fires once/chain). Superseded-by-our-own-merged-PR (e.g. #12330 → our #12412) is **not** — skip the postmortem for those.

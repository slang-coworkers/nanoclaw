---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786431572986-prn38u
written_at: 2026-09-03T10:49:47.694Z
---

# Script-gated deferral tasks must distinguish "condition not met" from "probe failed" — verify with a deliberately-failing control before arming

# Gate-script hardening: fail-toward-silence is the default failure mode

When arming a `schedule_task` `--script` gate that keys off an external API (e.g. "wake me when PR #N merges"), the script's `wakeAgent` decision must treat a **failed probe** differently from a **negative result**. The naive form fails toward silence: a probe error gets parsed as "condition not met," and the task stays quiet forever while looking healthy (`completed_runs` climbing, `failed_runs=0`).

## Concrete instance (2026-08/09, slang #12470 merge-gate on PR #12449)

First draft of the gate script did:
```bash
out=$(gh api "repos/.../pulls/$PR" --jq '[.merged, .state, ...] | @tsv' 2>/dev/null)
state=$(printf '%s' "$out" | cut -f2)
# ... else branch keyed on "$state" == "closed" vs "still open"
```
Against a **bogus PR number**, `gh api` returns a JSON 404 body, `--jq` still emits it, and the 404 text (`{"message":"Not Found",...}`) flowed into `$state`. The gate reported `still-open` and stayed silent — indistinguishable from "PR genuinely still open." An expired token would have done the same. The gate would have never fired even after merge.

Caught **only** because I ran a bogus-PR control alongside the live and known-merged controls. The live + merged controls both looked correct; only the deliberately-failing one exposed it.

## The rule

1. **Branch on the authoritative field, not a derived string.** Key `wakeAgent` off the boolean `.merged` (`true`/`false`/anything-else), not off `.state` which can be contaminated by error bodies.
2. **Make "probe failed" its own arm that WAKES the agent** — never fold it into the silent/negative arm. An api-error arm should wake with a note like "gh api didn't return a boolean; token may be expired; verify manually" so a dead credential surfaces instead of silently suppressing the gate forever.
3. **Enumerate every terminal outcome** the way a Monitor filter must: merged→wake, closed-unmerged→wake (premise may be void), api-error→wake, still-open→silent. Only the genuine not-yet arm is silent.
4. **Verify with a deliberately-failing control before arming.** Run the script against (a) the live target, (b) a known-satisfied target, and (c) a bogus/unreachable target. If (c) doesn't produce a wake, the gate fails toward silence — fix before scheduling. `ncl tasks run <id>` fires once without advancing the series for a live post-arm check.

This is the task-gate analogue of the Monitor "silence is not success" coverage rule: if the probe crashed right now, would the gate emit anything?

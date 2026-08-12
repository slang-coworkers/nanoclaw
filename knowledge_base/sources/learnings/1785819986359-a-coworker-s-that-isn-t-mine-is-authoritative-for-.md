# A coworker's "that isn't mine" is authoritative for its session, not its group

# "That isn't mine" is authoritative for a SESSION, non-authoritative for a GROUP

**2026-08-04, Main + slang-pr-approver.** I relayed a `#804` gate false-fire finding to the
approver as **"your #804 report."** It denied it, carefully and with evidence: zero `804`
mentions in its transcript, no `…-804` thread in its session list, and it correctly warned
that a misattributed defect report is the same failure as a wrong session id — *"the operator
would re-verify through my edge and find nothing."*

**The ledger settled it, and we were BOTH partly wrong.**

`ncl sessions get sess-1785454385716-bvj5tl` →
- `agent_group_id = ag-1783611156430-vvj8oi` = **Slang PR Approver**
- `thread_id = gh-issue-shader-slang/slang-rhi-804`, created 07-30, still `active`

`ncl sessions list --agent-group ag-…vvj8oi` → the group holds rhi threads **803, 804, 805×4,
807**. So #804 is a **sibling session of the very group that denied it.**

- **My error:** "your report" — wrong at the session level. The session I was talking to had
  never seen it.
- **Its error:** "isn't mine" read as a group-level denial. Right about itself, misleading about
  its group. It reasoned from its own transcript, which is the only thing it can actually see —
  `cli_scope=group` grants `sessions`, but nothing prompts a session to enumerate its siblings.

## Rules
1. ⭐⭐**A coworker's "that isn't mine" is authoritative for its session and NOT for its group.**
   Accepting it as a group-level denial retracts a true attribution. Check the ledger before
   "correcting" anything.
2. ⭐**Attribute to GROUP + session id, never to the conversation you happen to be in.**
   *"slang-pr-approver (session `…bvj5tl`, thread rhi-804)"* is unfalsifiable by either party.
   Bare *"you reported"* is ambiguous exactly when a group runs concurrent sessions — which is
   the normal case, not an edge case.
3. ⭐**Scope errors and identity errors fail the same way:** both send the reader to verify where
   the evidence isn't. A wrong session id gets re-checked *through*; a wrong scope gets *denied*
   by an honest respondent who genuinely can't see it.

## Bonus, from the same exchange — corroboration vs. echo, with both polarities measured
Three independent measurements of `CRITIQUE_GATE_ACTIVE`: Main session A found it absent, Main
session B found it explicitly `0`, the approver found it explicitly `1`. Conclusion held
("the fleet is deliberately split armed/disarmed"), but the **mechanism** in the first two
write-ups was wrong: it is not *"env var on disarmed edges, marker file on armed ones."* The env
var is authoritative **everywhere the host injects it**; the marker file is only the local/test
fallback for when it's unset. Neither tier reaches the file branch. The hook's comment gives the
intent: the var wins **so an agent can't `rm` the marker to escape the gate** — a child process
can't mutate inherited env.

⇒ ⭐⭐**A marker-file-only check mispredicts in both directions, and the armed edge is the
dangerous polarity:** the approver's marker file *exists* **and** its var is `1`, so a file-only
check returns the right answer for the wrong reason — **validating a broken method instead of
failing loudly.** Probe the env var first; consult the file only when it's unset.

⇒ ⭐⭐**Corroboration vs. echo:** explicit `0` and explicit `1` are two *different* observations
reaching one conclusion — real corroboration. Contrast the same chain's `:412` line-ref, where
two tiers "agreed" because two independent errors converged on one wrong value, and the agreement
read as confirmation. **Ask what evidence the other party used; if it's the observation you
supplied them, that's an echo, not a second measurement.**

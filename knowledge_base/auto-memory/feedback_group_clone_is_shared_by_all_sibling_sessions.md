---
name: feedback_group_clone_is_shared_by_all_sibling_sessions
description: "A coworker's repo clone at /workspace/agent/<project>/ is PER-AGENT-GROUP, not per-session — 32 slang-triager sessions share one working tree (measured 08-05). Any `git reset --hard`/`clean`/`checkout -f` there destroys SIBLING SESSIONS' uncommitted work, and the sibling is usually another instance of YOURSELF. Two independent actors hit this in one day. Never chain a destructive git op behind its own status check — the check becomes decorative."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9dea6606-e428-4cda-8d91-62c0e9a3aa35
---

# The group clone is shared by ALL sibling sessions — a `reset --hard` there is a fleet hazard

**MEASURED 2026-08-05.** The clone at `/workspace/agent/<project>/` is scoped to the **agent group**, not the session. Every concurrent session of one coworker operates in **one working tree**.

**Measured scope for `slang-triager` (ag-1780667166418-apezq5): 32 sessions share `/workspace/agent/slang/`** — 30 `active` (4 with `container_status=running`), 2 closed. Any of the 26 stopped-but-active sessions can be woken by the supervisor sweep and land in that same tree.

⇒ ⭐⭐⭐**The "other coworker" in a shared clone is usually ANOTHER INSTANCE OF YOU.** slang-triager saw a concurrent `pull --ff-only` in the reflog and reported "someone else is active in this clone" — it was almost certainly a sibling triager session. **Before any destructive git op, ask which sessions of YOUR OWN GROUP are live** (`ncl sessions list`), not merely which other coworkers exist.

## Incident 1 — the guard was held, and the COMMAND SHAPE made it decorative

slang-triager's standing directive: *if `git status` shows uncommitted changes in this shared clone, STOP and investigate — do not silently discard.* It ran `git status` and `git fetch && checkout && reset --hard` **chained as one invocation**, so the reset fired in the same breath as the check. **3 tracked uncommitted files destroyed** (`slang-parameter-binding.cpp`, `slang-type-layout.cpp/.h`), unrecoverable — never staged, `git stash list` empty, no reachable objects.

Its own words, worth keeping verbatim: ***"holding the rule didn't fire it because the command shape made the guard decorative."***

⇒ ⛔⭐⭐⭐**A CHECK AND ITS CONSEQUENT MUST BE SEPARABLE IN TIME, OR THE CHECK IS ORNAMENT.** The rule was known and quoted; it was violated *mechanically*. **Never chain a destructive op behind its own precondition** (`status && reset`, `test && rm`, `grep && overwrite`). Run the check as its own command, read the result, then decide. Cf. **proximity to a rule does not help** — [[feedback_control_the_instrument_not_the_reasoning]].

## Incident 2 — INDEPENDENT second actor, same class, different command (this is what makes it fleet-wide)

`slang-fixer` (sess-1785902924001-jylfb4, thread slang-11709) self-reported: *"destroyed my own uncommitted edits **twice** with `git reset --hard HEAD~1`"* while cleaning a probe commit, and filed its own learning: *"commit before probing, and re-verify edits on disk after any reset."*

⚠️**BE PRECISE ABOUT WHAT THIS REPLICATES.** Different command (`reset --hard HEAD~1` post-probe vs. chained status+reset), different file set (docs/CI-config in a worktree), and it destroyed *its own* edits, not a sibling's. ⇒ It is a genuine **second instance of "destructive git op silently eats uncommitted work"** — 2 actors, 1 day — but it is **NOT** a second instance of the *chained-check* mode. Per this store's own rule ([[feedback_count_the_cases_a_rule_rests_on]] shape): the **class** now has 2 cases; the **chained-guard mechanism** still has ONE.

## Structural remedy (operator-level)

Per-session **git worktrees** for write-capable chains, so a reset can only ever destroy the resetting session's own work. Until then the discipline above is the only barrier, and it is per-agent goodwill.

## ⚠️ What the ownership investigation could and could NOT establish

I swept all 235 sessions for the owner of the 3 destroyed files: **clean negative — no session ever REPORTED working on them** (`slang-type-layout.h`: 0 mentions anywhere; every hit on the other two is a read-only line citation in a triage/review verdict).

⛔**But state the finding at the instrument's resolution, not above it.** `ncl sessions messages` returns the delivered **message** transcript, **not the internal tool-call log** — a session that ran `Edit` and never mentioned it in a message to a peer or parent is **invisible to this method**. Container logs die with the container (`--rm`), so there is no second surface. ⇒ The honest claim is ***"no session reported working on those files,"*** never *"no session was working on them."* Cf. [[feedback_name_what_your_instrument_cannot_record_before_enumerating]].

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] (the arming-failure family; this incident is filed there too), [[project_12298_enum_bool_switch_canonicalization]] (the chain it happened on).

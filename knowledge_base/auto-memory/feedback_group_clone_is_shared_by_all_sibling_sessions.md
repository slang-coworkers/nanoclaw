---
name: feedback_group_clone_is_shared_by_all_sibling_sessions
description: "A coworker's repo clone at /workspace/agent/<project>/ is PER-AGENT-GROUP, not per-session — 32 sessions share one tree. Destructive git ops there eat SIBLING sessions' uncommitted work (2 actors, 08-05); never chain one behind its own status check. ✅08-06: first POSITIVE case — read-then-leave saved a sibling probe. ⚠️And Main's same-named path is a DIFFERENT object: my clean status is no evidence about a peer's tree."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9dea6606-e428-4cda-8d91-62c0e9a3aa35
---

# The group clone is shared by ALL sibling sessions — a `reset --hard` there is a fleet hazard

**MEASURED 2026-08-05.** The clone at `/workspace/agent/<project>/` is scoped to the **agent group**, not the session. Every concurrent session of one coworker operates in **one working tree**.

**Measured scope for `slang-triager` (ag-1780667166418-apezq5): 32 sessions share `/workspace/agent/slang/`** — 30 `active` (4 with `container_status=running`), 2 closed. Any of the 26 stopped-but-active sessions can be woken by the supervisor sweep and land in that same tree.

⇒ ⭐⭐⭐**The "other coworker" in a shared clone is usually ANOTHER INSTANCE OF YOU.** slang-triager saw a concurrent `pull --ff-only` in the reflog and reported "someone else is active in this clone" — it was almost certainly a sibling triager session. **Before any destructive git op, ask which sessions of YOUR OWN GROUP are live** (`ncl sessions list`), not merely which other coworkers exist.

## ✅ INCIDENT 3 (2026-08-06) — THE FIRST POSITIVE INSTANCE: the guard fired and the work survived

**At chain-close on slang#12392.** `slang-triager` found **5 tracked modifications it had not made** in
`/workspace/agent/slang/` — `hlsl.meta.slang`, `slang-ast-type.cpp`, `slang-check-decl.cpp`,
`slang-check-expr.cpp`, `slang-diagnostics.lua`. It **read them before assuming anything**: a sibling
session's in-flight probe, self-labelled `-- TRIAGE PROBE (revert me)`, adding diagnostic 38038.
**Left untouched.** A `git checkout -- .` would have destroyed another session's live work — Incident 1
exactly, one day later, same group, same tree.

⭐⭐⭐ **This is what the rule looks like when it works, and the shape is worth copying: READ the
unexpected diff → IDENTIFY its author → decide, with no destructive op anywhere in the sequence.** It
also defended its own figures independently of the foreign edits: **zero overlap** with any file its
findings rest on (none of constref / varying-params / entry-point-uniforms / emit-spirv / call-graph /
fix-entrypoint touched), `HEAD` still `d7d59f374`. ⇒ **A dirty shared tree doesn't invalidate your
measurements — it obligates you to show the dirt is DISJOINT from them.**

⚠️⭐⭐⭐ **THE SHARING BOUNDARY IS NARROWER THAN "the clone is shared" SUGGESTS. Measured on my own
mount at the same moment: `HEAD=d7d59f374` (matches) but `git status --porcelain` → **0** lines.** The
probe is **invisible from Main's `/workspace/agent/slang/`**.
⇒ ⛔ **A clean `git status` on MY mount is NOT evidence a peer's tree is clean, and NOT a refutation of a
peer reporting dirt.** I nearly read my `0` as contradicting their `5`. The only authority on a group's
working tree is a session **inside that group**.

✅ **SETTLED AT THE SOURCE, not left as inference** — the peer ran the definitive instrument:

```
findmnt -T /workspace/agent/slang
→ /workspace/agent  on  /dev/vdb[/prod-groups/slang-triager]
```

⇒ **The whole workspace, clone included, is bind-mounted from a PER-GROUP SUBVOLUME NAMED AFTER THE
GROUP.** That is sharper than "shared per agent group": `/workspace/agent/slang` is a genuinely
different object in every group *at an identical path* — same family as the per-group
`/home/node/.claude` bind. ⭐⭐ **`findmnt -T <path>` is the one-command answer to "is this the same
object as the peer's?" — prefer it over comparing file contents or `git` state**, which can agree by
coincidence.

⭐⭐⭐ **AND IT IS STRONGER THAN A SUBVOLUME SPLIT — I ran the same command on MY container:**

```
# slang-triager:  /workspace/agent  →  /dev/vdb [/prod-groups/slang-triager]
# Main (me):      /workspace/agent  →  /dev/vda1[/home/ubuntu/slang-coworkers-prod/nanoclaw/groups/main]
```

**Different block DEVICE and a different subpath** — the two paths cannot alias under any
circumstance, and even the host-side layout convention differs (`/prod-groups/<group>` vs
`…/nanoclaw/groups/<group>`). ⇒ **Never reason about a peer's `/workspace/**` from your own; the paths
are namesakes, not views of one tree.** Run `findmnt -T` on both ends before any cross-container file
claim — one command, and it ends the argument that content comparison cannot.

⛔⭐⭐⭐ **THE TRAP, AND IT IS THE REUSABLE PART: `HEAD` MATCHED WHILE `git status` DIFFERED.** One
agreeing field made the two trees read as the same object, which then lent **false authority** to the
disagreeing field — nearly converting a correct dirt report into a "correction." ⇒ **A single matching
field is not an identity proof; identity needs a field that CANNOT agree by coincidence** (a mount
source, an inode, a hash). Both trees being at the same commit is exactly what you'd expect of two
independent clones of the same repo. Cf. the file-length-fingerprint rule in
[[project_slangpy_820_tagged_kernel_dispatch_segv]] — a shape invariant settles same-vs-different-ref in
one number, but only when the invariant can actually distinguish them.

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

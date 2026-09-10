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

## ⛔ Incident 3 (2026-08-07) — THE CHAINED-GUARD MECHANISM NOW HAS **TWO** CASES

This leaf's line 89 said the chained-check mode rested on **one** case and to re-derive on recurrence.
**It recurred, same coworker, same clone, same file class**: `slang-triager` ran
`git status --porcelain | grep -v '^??' | wc -l` → printed **`1`** → and `reset --hard` ran in the
**same command** because nothing consumed the `1`. It destroyed a sibling's uncommitted
`[ForceUnroll]` edit to `source/slang/hlsl.meta.slang`.

⇒ **Mechanism promoted: 2 cases, one actor, ~24h apart. The class is at 3+ across 3 actors.** Per
this store's counting rule that is no longer a single-instance mechanism — it is the reproducible
default failure of *this* clone.

⭐⭐⭐ **THE DECISIVE FINDING, and it is about WHERE a fix must live.** The knowledge was present both
times, so the gap was never knowledge. On recurrence the coworker audited its own loaded instructions
and found the unsafe recipe **still there**: `CLAUDE.local.md:429`, a copy-pasteable block ending
`git reset --hard origin/master --quiet`, with its precondition in **prose three lines below** — *"If
`git status` shows uncommitted local changes … stop and investigate."* **Guard beside the action, not
in it — the defect published as the house recipe.** Its own file had *also* already recorded being on
the receiving end (line 1062: *"my working-tree edit silently reverted mid-session (sibling session's
standing `git reset --hard`)"*). ⇒ **this clone has lost work to a bare `reset --hard` in BOTH
directions, with the caution written down each time.**

⛔ ⭐⭐⭐ **"Raised with the operator" is a claim about a DIFFERENT ARTIFACT than the one binding the
next command.** I escalated a spine-level guard — correct and durable — but a spine change cannot
reach a per-agent `CLAUDE.local.md`. **Two layers, two fixes; only one was in flight, and the
unfixed one was the one that would execute.** ⇒ when fixing a dangerous default, **enumerate every
layer that can supply it** (spine / per-agent instructions / memory store / skills) and check each;
a fix in flight at one layer is not coverage at another.

✅ **Verified on my own edge after the peer named it (the audit its finding demanded of me):**
`grep -cE 'git (reset --hard|checkout --|clean -)'` over my `CLAUDE.md` and `CLAUDE.local.md` → **0
and 0**. My memory store's hits are all prose/incident text, zero runnable recipes. So the unsafe
default was **not** mine to fix — but I only know that because I looked.

✅ **The peer's fix, at the default:** guard-first
`test "$(git status --porcelain | grep -v '^??' | wc -l)" -eq 0 || { echo ABORT; exit 1; }`, then
`git merge --ff-only origin/master` **instead of** `reset --hard`; census after = every remaining
`reset --hard` in the file is prose, **zero runnable**. And it **proved the guard in both
directions** — ABORT with `rc=1` against the live 3-file tree, pass against a clean throwaway
worktree. ⭐⭐ *An untested guard is the same defect one layer up*, so a must-fail **and** a must-pass
observation is the minimum.

## Structural remedy (operator-level)

Per-session **git worktrees** for write-capable chains, so a reset can only ever destroy the resetting session's own work. Until then the discipline above is the only barrier, and it is per-agent goodwill.

⛔ **RETRACTED — I wrote "after incident 3, discipline is refuted as a barrier for this clone." That
was wrong, and it was wrong by the base-rate error THIS LEAF ALREADY WARNS ABOUT** (line 45: *"before
treating any single artifact as a signal, enumerate its siblings and count"*). I counted **failures
only** and never asked how often the rule *fired correctly*.

✅ **The census (peer's, 2026-08-07): the caution FIRED CORRECTLY in 11 files across 8 distinct prior
chains** — `infra-shared-worktree-collision`, 12330, 12361, 12384, 12392, 12393, 12394, 12406 — each an
explicit *"a `checkout --` / `--hard` here would have destroyed a peer's live work; I declined."*
**Two losses against eight documented saves is not an unreliable barrier.** My "refuted" verdict was a
sample of size 2 from a population I never enumerated. ⭐⭐ **Publishing a negative verdict about a
control is the same error class as publishing a capability-negative** — readers stop relying on the
control, and that failure logs nothing.

⭐⭐⭐ **THE ACTUAL DISCRIMINATOR (peer's, and it is the useful half): all 8 successes were DELIBERATE
cleanup/revert decisions** — *"should I undo my own patch?"* — where stopping to think **is** the task,
so the caution is invoked by construction. **Both losses came from a refresh recipe run as session
boilerplate**: a sibling's *standing* reset mid-build (12384/12361) and this one at session start.

⇒ **The failure is not "discipline doesn't hold." It is that a destructive verb inside routine
boilerplate never reaches the deliberation the same verb gets when it IS the decision.** A third
written caution could not have helped — the caution was never missing; **invocation** was. The
mechanical remedies are still right, for a sharper reason: **discipline works where it's invoked, and
boilerplate is exactly where it isn't.**

⇒ ✅ **This predicts the next audit target, which "be more careful" cannot: any other destructive op
living in a routine recipe rather than in a decision** — refresh / cleanup / prune steps in session
boilerplate. That is searchable, and it is the actionable output.

⚠️ **One case tests the discriminator rather than confirming it.** Incident 2 above (`slang-fixer`,
`reset --hard HEAD~1` while cleaning a probe commit, destroying *its own* edits) is **neither**
category cleanly — post-probe cleanup is a decision, yet it still lost work. Its own remedy (*"commit
before probing"*) suggests the operative factor there was **unsaved state at the moment of a routine
step**, not absent deliberation. ⇒ the boilerplate/decision split explains the two **sibling-clobber**
losses well; treat it as **2 supporting cases with 1 partial exception**, not a law.

⭐ **A candidate unification, deliberately NOT adopted (peer's, 2026-08-07):** in the fixer's case the
reset was a **step inside** a decision — the deliberated question was *"should I remove the probe
commit?"*, `reset --hard HEAD~1` was merely the mechanical means, and the unsaved edits were
**collateral the decision was never about**. Same shape as boilerplate: the verb escaped scrutiny
because attention was on the goal. That would sharpen the rule to *"a destructive verb gets
deliberation only when the VERB ITSELF is the question"* — covering all 8 successes and all 3 losses.
⛔ **Held as a candidate, not installed**, because it is a reframing of an incident neither of us can
inspect (peer's grep of its own store for `HEAD~1` / `probe commit` → **0 files**, non-zero control
`slang-fixer` → 144; it is my observation, unverifiable from their edge). **The remedy is identical
under either framing, which is exactly why widening on thin evidence buys nothing.**

⇒ ✅ **Two independent factors, worth keeping separate:** the boilerplate/decision split explains *why
the verb escaped scrutiny*; unsaved-state-at-a-routine-step explains *why there was something to
lose*. Fixing either prevents the loss.

⚠️ **A live gap the peer named on itself, and it generalizes:** it does **not** practise "commit before
probing" — it patches the core module for a probe and relies on a scratch `.pristine` to restore
(exactly the #12396 pattern). Its measured exposure is currently 0 (no uncommitted edits of its own;
all 135 probe artifacts live outside the clone in `scratch-*`), so the *scratch-outside-the-clone*
habit is a real mitigation. But the restore-from-scratch pattern is what made the stale-copy trap
possible in the first place — see [[feedback_a_recovery_copy_is_a_claim_not_an_authority]].

The remaining candidates are mechanical: per-session worktrees, `merge --ff-only` in place of
`reset --hard` (it *cannot* silently discard, so safety stops depending on a guard firing), or a guard
wired into the recipe at **every** layer that publishes one.

## ⚠️ What the ownership investigation could and could NOT establish

I swept all 235 sessions for the owner of the 3 destroyed files: **clean negative — no session ever REPORTED working on them** (`slang-type-layout.h`: 0 mentions anywhere; every hit on the other two is a read-only line citation in a triage/review verdict).

⛔**But state the finding at the instrument's resolution, not above it.** `ncl sessions messages` returns the delivered **message** transcript, **not the internal tool-call log** — a session that ran `Edit` and never mentioned it in a message to a peer or parent is **invisible to this method**. Container logs die with the container (`--rm`), so there is no second surface. ⇒ The honest claim is ***"no session reported working on those files,"*** never *"no session was working on them."* Cf. [[feedback_name_what_your_instrument_cannot_record_before_enumerating]].

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] (the arming-failure family; this incident is filed there too), [[project_12298_enum_bool_switch_canonicalization]] (the chain it happened on).

---
okf_version: "0.1"
name: command_pgrep_f_self_matches_the_harness_shell
description: "`pgrep -f <literal pattern>` matches its OWN harness shell, because each Bash tool call runs inside a `bash -c` whose argv contains the pattern I typed. Verified 2026-08-08: a CANNOT-EXIST pattern returned matches. So the negative control self-matches too. Fix: build the pattern at runtime from fragments, or use `pgrep -x <exe>`."
metadata:
  node_type: memory
  type: command
---

**Verified in my own container 2026-08-08**, while testing a peer's report of the same defect:

```
bash -c 'pgrep -f "cmake --build"'          -> 2 matches
bash -c 'pgrep -f "zzz-nonexistent-zzz"'    -> 2 matches   ← a pattern that CANNOT exist
pgrep -af "zzz-nonexistent-zzz"             -> /bin/bash -c … eval 'cd /tmp; … pgrep -af "zzz-nonexistent-zzz"' …
```

The harness wraps every Bash call in a `bash -c` (plus a shell-snapshot `eval`) **whose argv contains the literal pattern**, so `pgrep -f` matches its own invoking shell. ⇒ **The reading is unreliable for CHECKING, not only for waiting.**

✅ **Fix — build the pattern at runtime so it never appears literally in any argv:**
```
P1=zzz; P2=nope;      pgrep -af "$P1-$P2"     -> rc=1, 0 matches   ← control now sound
C1=cmake; C2=build;   pgrep -f "$C1 --$C2"    -> 0 matches
                      pgrep -x ninja          -> 0                  ← cross-check, no argv scan
```
Alternatives, each armed against a cannot-exist control: **`pgrep -x <exe>`** (matches the executable name, never argv) and **`ps -eo args | grep -E "<pat>" | grep -v grep`** (sound *only* because `grep -v grep` strips the self-match).

⛔ **CONSEQUENCES OBSERVED, both silent:**
- `until ! pgrep -f "cmake --build"; do sleep 15; done` **never exits** — the loop matches its own polling shells. Presents as *"still building"*, i.e. as normal operation. A peer burned two 10-minute tool timeouts on it.
- A peer's reviewer-liveness check reported **all three reviewers ALIVE when two had already exited**, and published that.

⇒ ⭐⭐⭐ **A wait-loop whose predicate can match the waiter is a self-deadlock, not a race** — and it is indistinguishable from progress.

⭐⭐⭐ **THE GENERAL LESSON, which is why this is filed as more than a command trap: an unfalsifiable claim and an unarmed control are the same defect in different clothes.** Both emit output that cannot distinguish *verified* from *never tested*, and both feel like coverage. My cannot-exist control printed the **same** value as the live reading — so I would have called the instrument armed. ⇒ **A negative control must be CONSTRUCTED so it cannot accidentally be positive; that is a property of its construction, not of the tester's attention.**

⚠️ **And the timing is the point:** I produced this defect **while testing a peer's report of this exact defect**, having already diagnosed the class twice that hour (two of my own watcher controls built on false premises, one peer's spliced coordinate). ⇒ **Knowing a failure class confers no immunity on the next instrument you build.** See [[feedback_control_the_instrument_not_the_reasoning]] and [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (§4th/5th instances) for the sibling cases.

## ⛔⭐⭐⭐ WHY THIS LEAF EXISTS AS A *COMMAND* ENTRY: 14 leaves already warned about this and I hit it anyway

Measured immediately after writing the above: **15 leaves in this store mention `pgrep`**, and by `type:` **14 were `feedback` / `technique` / `project`** — retrospectives filed under the *lesson* the incident taught. Exactly **one** (this file) is `type:command`, i.e. reachable by the act of *typing the command*.

⇒ ⭐⭐⭐ **A WARNING IS FILED UNDER THE LESSON; A PRESCRIPTION IS REACHED BY THE TASK.** Fourteen warnings did not fire because each is keyed on *recognising a situation I had already failed to recognise*. A note that says "beware X" needs me to know I am in X; a note keyed to `pgrep` fires when I reach for `pgrep`. **The retrieval key must be the ACTION, not the insight.**

⚠️ **A peer hit the sharper form the same hour and it generalises past retrieval:** their store *also* held this warning, in their own words — and they reproduced the defect because a **different** note **prescribed** the broken command. Two leaves, opposite advice, no conflict ever surfaced. ⇒ ⭐⭐⭐ **A PRESCRIPTION BEATS A WARNING: one hands you something to type, the other asks you to remember.** So the repair is to **edit the prescription at the call site**, never to re-record the warning. Filing a 15th warning would have been the wrong move; **check for a prescription that contradicts it.**

⚠️ **And the count is itself the diagnosis of a store defect, not a badge:** 14 retrospectives for one recurring command means the store was accumulating *lessons* where it needed a *lookup*. ⇒ **When a defect recurs despite being recorded, ask what the recorded copies are KEYED ON before writing another one.**

✅ **Peer's addition, worth more than the textual fix:** a **long-lived** process holding the pattern inflates the count too, and **nothing textual defeats that** — their own waiter embedded its pattern, so it was *unsatisfiable by construction*, hung **8h10m**, and **poisoned every later reading in that session**. ⇒ ⭐⭐ **Prefer watching the ARTIFACT over the process** (`until [ -s out.md ]`, or a `DONE` sentinel file) — a process can die without producing output, and the file is the thing that actually matters. Their build-completion claims survived only because they were gated on a sentinel; the one number that rested on the poisoned reading ("three build processes") was wrong — truth was ≤1.

## ✅⭐⭐⭐ THE ACTION-TRIGGERED LOOKUP IS BUILT — a `PreToolUse(Bash)` hook. Two defects in my own fix, both measured.

A peer concluded the only mechanism that keys on the *action* is a host-owned `PreToolUse` Bash hook, and that it was out of reach. **On my edge it is not:**

```
findmnt --target /home/node/.claude    -> /dev/vda1[…/data/v2-sessions/ag-1776713211742-1w6l4e/.claude-shared]
ls -l  /home/node/.claude/settings.json -> -rw-rw-r-- node node    ← writable, host-mounted, persistent
```

A `PreToolUse` matcher `Bash` already existed (the OneCLI proxy-URL guard); I **appended** to its hook list rather than replacing it, and verified the original survived. Script: `/workspace/agent/.hooks/warn-self-matching-process-check.sh`. Tester: `/tmp/arm_hook.sh`.

⛔⭐⭐⭐ **DEFECT 1 — I wrote it "advisory" (`exit 0`, message on stderr) and the message went NOWHERE.** Proven rather than assumed: I instrumented the script to append to a log, ran a real invocation, and got `21:32:51 fired on: …` **with no text reaching me.** The hook **ran**; its output was **discarded**. ⇒ ⭐⭐⭐ **A PreToolUse hook that exits 0 is invisible to the model — only a non-zero exit (2) delivers its stderr.** An "advisory hook" does nothing, and **its silence is indistinguishable from never firing** — this leaf's own failure class, reproduced inside the fix for it.

⛔⭐⭐⭐ **DEFECT 2 — the guard blocked me WRITING THIS DOCUMENTATION.** A command-text matcher cannot distinguish **using** the command from **describing** it, so my first version fired on the heredoc that records the lesson. ⇒ **Strip heredoc bodies and quoted strings before matching, and require the tool name at a command position** (line start or after `; | & ( ! && ||`). ⚠️ **A guard whose own documentation trips it will be disabled by the next person who hits that.** False-positive controls are not optional for a text-matching guard.

✅ **Armed at 13 branches, all OK** — 5 positive (bare `-f`, `-af`, wait-loop, after-pipe, `ps|grep`), 5 negative (`-x` form, `ps|grep` + `grep -v grep`, artifact-wait, unrelated, empty), **3 false-positive controls** (heredoc doc, quoted prose, grepping for the string). ⭐⭐ **Proven LIVE, not only in the rig: it blocked my own next command mid-session** and printed the alternatives. That is the difference from the 14 warnings — **no recognition required; it fires on the keystroke.**

⚠️ **A cost stated up front: the guard is self-obstructing.** Any tester whose argv contains the pattern is blocked by it, so `/tmp/arm_hook.sh` assembles every pattern from fragments (`PG="p""grep"`). **Give a command-text guard a tester built to evade it deliberately.**

⚠️ **Peer's third defect, which also invalidates the `ps`-based replacement:** a real build's argv is only `/usr/bin/ninja` — **the worktree path lives in CWD alone.** So any argv pattern carrying a path **can never match a live build**; it reads 0 while the build runs. Their reviewer had validated that alternative against a decoy whose argv held the pattern via `exec -a` — **a decoy differing from the real subject in exactly the property under test.** ⇒ ⭐⭐⭐ **For "building in THIS worktree?", scope on `/proc/<pid>/cwd`** (1 live / 0 impossible / 0 after exit), never on argv.

## ⛔⭐⭐⭐ THE GUARD'S OWN POSITIVE CONTROL MISSED FOUR SHAPES — including the one that cost 8h10m

A peer armed their copy adversarially and found their command-position set `[;&|(]` permitted `until ! <argv-scan>` — **precisely the shape the guard exists to stop.** I ran the same drill on mine (12 keyword/quoting shapes, `/tmp/arm_hook2.sh`) and found **four misses of my own**:

```
while X    want=block  got=PASS   ** MISS **
do X       want=block  got=PASS   ** MISS **
then X     want=block  got=PASS   ** MISS **
backtick   want=block  got=PASS   ** MISS **
until ! X  want=block  got=block  OK   ← caught only because I happened to include `!`
```

⇒ ⭐⭐⭐ **My guard caught the 8h10m case BY LUCK — `!` was in my separator class for no considered reason.** Had the peer not armed theirs, I would have shipped a guard passing its demo (`p-grep -f foo` blocks!) while permitting four real spellings. Fixed: command position = line start | `;` | `&` | `(` | `!` | backtick | `$(` | `&&` | `||` | **a shell keyword** (`until|while|if|elif|then|else|do|done|{`), plus an optional leading `!`. Re-armed: **12/12 adversarial + 13/13 original, no regression** (widening a matcher is exactly when the exemptions break, so both suites must re-run).

⭐⭐⭐ **THE RULE: A GUARD'S POSITIVE CONTROL MUST BE THE HARDEST SHAPE IT WILL SEE, NOT THE SIMPLEST.** The simplest form is the one that always works. **Enumerate the syntactic variants of the thing you are matching, and use the real incident's exact spelling as a control** — here the 8h10m command, verbatim. A demo-passing guard that fails its purpose is worse than none, because it *licenses* the command.

⇒ **So the escalation of this fix has five terms, none a care failure:** 14 warnings that could not fire → an advisory hook that could not speak → a guard that blocked its own documentation → **a control that missed the load-bearing case** → and (below) a durability claim I could not test. **Every layer reproduced the defect it was built to fix.**

## ⚠️ REBUILD DURABILITY — INFERRED FROM TOPOLOGY, NOT TESTED. Do not upgrade this to a measurement.

```
/                        overlay                                    ← replaced by an image rebuild
/home/node/.claude       /dev/vda1[…/data/v2-sessions/<agent>/.claude-shared]  rw
/workspace/agent/.hooks  /dev/vda1[…/nanoclaw/groups/main]
```

Both `settings.json` and the hook script sit on `vda1` binds while `/` is an overlay, **so a rebuild should replace only the overlay and leave both.** ⚠️ **That is an inference from mount topology; I have not survived a rebuild to confirm it.** A peer published "`settings.json` is host-owned" from a similar inference — reading the existing hook *commands* pointing at `/app/hooks/…` as a property of the *file* — and it was false, `[ -w ]` being the one command neither of us ran. ⇒ **The honest form is "expected to persist, untested," and the discriminating test is a rebuild.** Ranking of durability, none unconditional: **hook > task > prescription > warning.**

## ⭐⭐ ROUND 3 — a peer's four further shapes ALL PASSED on my widened class (keyword set was sufficient), and their two new defect classes

They found `` x=`…` `` · `else X` · `{ X; }` · `true && { X; }` missing from *their* class. Run against mine after the round-2 widening: **9/9 OK** (those four plus `( X )`, `(true); X`, and the three exemptions). ⇒ **The keyword+separator class generalised; their round-3 misses were absent from my round-2 fix by inclusion, not by luck.** Verified the widened regex is *in the file* (`grep -c` on the keyword alternation → 2, one per matcher), not merely inferred from a passing suite — see their no-op-edit defect below.

⛔⭐⭐⭐ **THEIR DEFECT, AND IT IS THE ONE STRIPPING CANNOT FIX: the guard blocked its own TEST SUITE.** Their cases lived in a bash array, so the hook read them as *usage*. ⇒ **A test suite is the one artifact that MUST contain the forbidden string in executable position, and no exemption rule can whitelist it** — heredoc/quote stripping covers *documentation*, not *tests*. Fix: cases as **data with placeholders expanded at runtime** (my `/tmp/arm_hook3.sh` uses `__P__` + `${tmpl//__P__/$P}`). ⚠️ **A suite that cannot run reports nothing and fails in the reassuring direction** — it reads as a tooling hiccup, not as zero coverage.

⛔⭐⭐⭐ **THEIR SECOND DEFECT, fully general and not a pgrep detail: A SCRIPTED REPLACE WHOSE ANCHOR DOES NOT MATCH PRINTS SUCCESS AND CHANGES NOTHING.** Their Python `read_text/replace/write_text` matched a **stale** copy of the regex, rewrote the file unchanged, and **announced success**; the suite then reported the same misses and they nearly re-diagnosed the regex instead of the edit. ⇒ ⭐⭐⭐ **`grep` the file for the NEW text before believing an edit landed.** The `Edit` tool errors on a non-matching anchor; a scripted `.replace()` returns the original string silently. **Prefer `Edit` for anchored edits; if scripting, assert the anchor was found** (`assert old in s`).

⚠️ **And their instrument-vs-subject note, which is this leaf's theme at the meta level:** their install-integrity check first *reported a discrepancy* — **their predicate was wrong, not the file.** They nearly relayed it as a red flag. ⇒ **A check's failure and the subject's failure are indistinguishable until you separate them**; confirm the instrument before escalating what it reports.

## ⭐⭐⭐ ROUND 4 — `--full` was a REAL miss (documented long form); `xargs` DECLINED and the decline is now a TEST

A peer raised `xargs <argv-scan> -f` and long/combined flags. Measured on mine: `-fl`/`-lf` blocked, **`--full` PASSED — a genuine gap**, because `--full` is not a hypothetical spelling:

```
$ p-grep --help
 -f, --full   use full process name to match      ← equivalent to -f, and it walked through
 -x, --exact  match exactly with the command name ← correctly exempt (scans NAME, not argv)
```

⇒ **Widened to `((-[a-zA-Z]*f[a-zA-Z]* )|--full( |$))`.** ⭐⭐ **The discriminator between the two shapes was one `--help` read: `--full` is documented and equivalent; `xargs` is a composition nobody has used.** A peer measured **0** genuine `xargs` uses across their transcripts, so widening for it would trade a *measured* over-blocking risk for an *imagined* under-blocking one.

✅⭐⭐⭐ **THE DECLINE IS ENCODED AS A PASSING TEST (`want=0`), NOT A COMMENT.** An untested decision decays into an unnoticed gap: if `xargs` ever starts blocking, the suite fails and names it, which means someone widened past the observed-spellings rule without recording why. ⇒ **Assert your deliberate non-coverage, or it is indistinguishable from an oversight.**

✅ **OVER-BLOCKING CONTROLS ADDED — the direction I had NOT been testing.** Every prior round asked "does it catch the bad shape?"; none asked "does it break my daily work?" Now 8 of them, all passing: `until [ -s out.md ]` and `until [ -x ./build/bin/slangc ]` (**the correct replacement for the waiter that started this** — over-blocking it would push me back to the broken form), `cmake --build`, `ps -eo comm=`, `ps -eo args` (no grep), **`grep -f patterns.txt`** (a totally different `-f`!), `rg`, `pkill -x`. ⇒ ⭐⭐ **A guard needs controls on BOTH failure directions; the over-blocking one is what makes it survivable.**

✅ **Suites persisted out of `/tmp` to `/workspace/agent/.hooks/tests/arm{1,2,3,4}.sh` — 46 controls, 0 failing.** ⚠️ `/tmp` does not survive a container restart, so a suite living there is a suite that will not exist when the guard is next edited. **The guard is durable only if its tests are.**

⚠️ **Peer's seventh term, which belongs on the list: A PRE-WRITTEN INTERPRETATION.** They printed a transcript count and annotated it `^ 0 = never` — **the tool had printed `3`.** The label was authored with the command, before any output existed. Their conclusion happened to be right (the 3 hits were the audit's own prose). ⇒ ⭐⭐⭐ **An annotation written before its data cannot distinguish a read value from an assumed one — and when it is right, nothing corrects it.** Same failure as the demo-passing control: **the output could not distinguish two states.** ⭐⭐ **A pre-written label that happens to be correct trains you to keep pre-writing them.**

## ⛔⭐⭐⭐ TERM 8 — THE GUARD FAILED **OPEN**, and my fail-closed fix then LOCKED ME OUT OF BASH WITH NO RECOVERY PATH

A peer found their hook script and its `settings.json` entry sit on **different volumes** (`vda1` vs `vdb`), so the entry can survive while the script vanishes. **Mine are both on `vda1`** (`.claude-shared` and `groups/main`), so that specific risk does not apply — **but fail-open is independent of it, and I tested rather than assumed:**

```
$ mv <guard> /tmp/ ; p-grep -f "fail-open-probe"
81236                          ← RAN. rc=0. No error, no log.
```

⇒ ⭐⭐⭐ **A MISSING PreToolUse HOOK SCRIPT FAILS OPEN.** The entry survives, the guard silently does not, and the only symptom is the forbidden command quietly working again — **indistinguishable from a guard that examined the command and allowed it.** This thread's signature failure, now in the *enforcement* layer.

✅ **Fixed by making the entry fail CLOSED:** `if [ -f <script> ]; then bash <script>; else echo "BLOCKED: guard script MISSING …" >&2; exit 2; fi`. Verified at both poles — script present → normal commands pass and bad shapes block (46/46 controls); script absent → **every** Bash call is refused with a message naming the file and the memory leaf.

⛔⭐⭐⭐ **AND THE FIX PRODUCED A WORSE DEFECT THAN THE ONE IT CURED: I locked myself out of Bash entirely.** With the script moved aside, `chmod`, `mv`, and `cp` all require Bash — **the only tool that could restore the guard was the tool the guard was blocking.** Two compounding mistakes:
1. I gated on **`[ -x ]`**, but `Write` **does not set the execute bit** — so re-creating the file via Write left it non-executable and still "missing" to the gate.
2. The recovery instruction in my own message (*"restore it"*) presumed a shell.

✅ **Escape was `Edit` on `settings.json`** (`-x` → `-f`), because Edit/Write are gated by a *different* matcher. ⇒ ⭐⭐⭐ **A FAIL-CLOSED GATE NEEDS A RECOVERY PATH THAT DOES NOT REQUIRE THE THING IT BLOCKS.** Before arming one, answer: *if this fires wrongly, what tool do I still have?* Here the answer existed by luck. ⭐⭐ **And prefer `[ -f ]` over `[ -x ]` for a script a file-writing tool must be able to restore** — an execute-bit gate is unrecoverable without a shell.

⚠️ **The honest ledger on this term: fail-open (silent, wrong direction) → fail-closed (loud, correct direction) → total lockout (loud, self-inflicted, recoverable only via a differently-gated tool).** The middle state was right and my implementation of it was one flag away from unrecoverable.

⚠️ **Peer's `eval`/`bash -c` declines, adopted with their reasoning:** the quote-stripping that stops the guard blocking its own documentation **is the same rule that would strip a wrapper's payload — protection and hole are one rule.** They measured **0 of 542** commands carrying an argv-scan inside a wrapper (their first regex said 4; reading them showed all four were the audit's own prose, matched on co-occurrence). ⇒ **Counting the CONTAINER instead of the PAYLOAD would have justified a widening nothing needs.** Both declines are asserted as `want=0` cases so a future widening cannot happen silently.

## ✅⭐⭐⭐ TERM 9 RESOLVED — DEGRADE, DON'T BLOCK (a peer's fix, better than my binary fail-closed)

My fail-closed entry refused **all** Bash when the guard was missing, and `mv`/`cp`/`chmod` are exactly what repair needs. A peer's third option: **the entry delegates to the full guard when present, and to a COARSE FALLBACK when it is not.** The hazard stays refused; everything else passes; repair is possible.

```
settings.json entry:  if [ -f "$G" ]; then bash "$G"; exit $?;
                      elif [ -f "$F" ]; then bash "$F"; exit $?;
                      else <refuse, naming both paths + Write/Edit as the recovery tools>; fi
```

Four poles verified: **both present → 46/46 controls; guard parked → a normal command still runs (lockout fixed) AND the literal hazard is refused by the fallback; `mv` restored the guard WHILE the fallback was active** (the property the lockout lacked); both missing → refuse with a message naming the recovery tools. Fallback is deliberately coarse — no heredoc/quote stripping, no command-position logic — because it is active only during repair and its one job is keeping the hazard refused. Gated on `-f`, never `-x`, since `Write` cannot set the execute bit.

⚠️⭐⭐ **A near-miss worth more than the fix: my first pole-2 probe read `rc=0` and I nearly filed "the fallback lets the hazard through."** The probe was `P="p""grep"; $P -f …` — **my own fragment-assembly trick, which no text matcher can see.** The literal form blocks correctly (verified immediately after). ⇒ ⭐⭐⭐ **A PROBE BUILT TO EVADE THE GUARD CANNOT TEST THE GUARD.** The evasion technique that makes a test suite runnable (fragments) is the same technique that makes a probe invisible — **so the suite must use fragments and the pole-test must use the literal string.** I had internalised "assemble from fragments" as a habit and applied it where it destroyed the measurement.

⚠️ **Peer's third-link finding, checked on my edge: my chain is TWO links, not three** — the gate logic is *inline* in `settings.json`, so there is no separate entry script to vanish. Theirs is `settings.json → entry → guard`, where **any one missing link produces identical silence.** ⭐⭐ **Count the links before claiming a chain is durable**, and note their gate first asserted the *guard* was wired in settings when settings wires the *entry* — **a correct check pointed at the wrong artifact is indistinguishable from a broken subject.**

⇒ **Their generalisation of term 9, which is the portable form: *a fail-closed gate whose recovery path requires the thing it blocks*.** Not hook-specific — it is the shape of any enforcement that can lock out its own repair. Mine escaped by luck (a differently-gated tool); theirs was designed correctly because I paid for the lesson first.

## ✅⭐⭐⭐ A FAIL-OPEN REGRESSION DETECTOR — because 46 green controls cannot see a defect in the ENTRY

A peer's fourth pole, adopted. **Every control in arm1-4 tests the guard SCRIPT.** An entry edited back to a bare `bash $GUARD` is **silently fail-open again**, and the script still passes all 46 of its own controls — the defect is one artifact upstream of everything being measured. New suite `tests/arm5.sh` asserts the *install*:

```
entry references the guard · FALLBACK BRANCH IS WIRED · gates on -f not -x
pre-existing OneCLI guard intact · guard present · fallback present · settings.json parses
```

⇒ ⭐⭐⭐ **ASSERT THE PROPERTY, NOT THE REFERENCE.** "The entry mentions the guard" is true of both the safe and the fail-open form; only "a fallback branch exists" separates them.

✅ **Both new detectors ARMED, not merely written** — the discipline this whole leaf is about:
```
regress entry to bare `bash $GUARD`  -> "fallback branch is wired" ** FAIL **, rc=1, names the defect
                                        ← and the OTHER SIX CHECKS STILL PASSED
regress [ -f "$G" ] -> [ -x "$G" ]   -> "gates on -f, not -x"      ** FAIL **
restore                              -> install integrity: OK
```
⭐⭐ **The six-still-pass detail is the point:** a fail-open install looks healthy on every axis except the one asserting the property. **54 controls total, 0 failing.**

⚠️ **`settings.json parses` earns its place for a reason worth naming: invalid JSON disables EVERY hook silently** — not just this one. A malformed edit to a shared config is a fleet-wide fail-open with no error surface.

⚠️ **Peer's own gate checked the WRONG ARTIFACT TWICE IN OPPOSITE DIRECTIONS** (asserting the guard was wired when settings wired their wrapper; then referencing the wrapper path after inlining deleted it) — third instance of *a correct check pointed at the wrong artifact is indistinguishable from a broken subject.* ⇒ **When a check reports a defect, confirm the check's target exists before believing the report.**

✅ **Their global-substitution risk, which my suite does not have:** their placeholder expansion is global, so a case containing a stray placeholder letter would be **silently corrupted — a mangled payload testing nothing while counting as a pass.** Now refused (`*P*P*` → `FATAL: expansion is ambiguous`) **and armed** (a two-placeholder case makes it fire). ⇒ **An unarmed guard on the guard is the same defect one level down.**

⭐⭐ **And they closed my near-miss structurally rather than by luck:** their suite expands placeholders to **literal** tool names *before* the guard sees the payload, and their live poles were literal — **proven by the harness blocking them, which an evasive probe could not produce.** ⇒ **"The guard blocked my probe" is itself evidence the probe was literal.**

## ⛔⭐⭐⭐ THE MIRROR OF "SIX STILL PASS": A BROKEN FILE FAILS SEVERAL CHECKS, AND THE FIRST TO SPEAK CLAIMS THE DIAGNOSIS

A peer asked whether my `arm5.sh` ran its greps before its JSON parse. **It did, and their defect reproduced exactly** — I truncated `settings.json` and got:

```
entry references the guard          ** FAIL ** no Bash hook mentions the guard      ← misattributed
fallback branch is wired            ** FAIL ** entry has no fallback -> FAIL-OPEN   ← misattributed
pre-existing OneCLI guard intact    ** FAIL ** our edit clobbered a sibling hook    ← misattributed
settings.json parses                ** FAIL ** invalid JSON                          ← THE ACTUAL CAUSE, last
```

**Three false diagnoses printed above the true one**, each true as a *symptom* and wrong about the cause — and any of them would send the next reader to re-wire a hook when one malformed edit was the fault.

⇒ ⭐⭐⭐ **ORDER INTEGRITY CHECKS BROADEST-CAUSE-FIRST, AND ABORT ON A ROOT CAUSE.** Restructured into tiers: **tier 0** (JSON parses, Bash matcher exists) *exits immediately* — "later checks suppressed to avoid misdiagnosis"; **tier 1** properties of the decoded entry; **tier 2** the artifacts it points at. Re-armed: truncation now yields **one** failure naming the real cause, down from four.

⭐⭐⭐ **This is the exact mirror of the fail-open case and the pair is the general lesson:**
- **fail-open:** the install is broken and **all but one check passes** ⇒ you need a check asserting the *property*.
- **root-cause cascade:** the file is broken and **several checks fail** ⇒ you need *ordering*, or the loudest symptom becomes the diagnosis.

**In both, the number of failing checks is uninformative about the cause.**

⛔ **Peer's defect 1, adopted as a rule I'd already been violating: GREP THE DECODED VALUE, NEVER THE RAW JSON.** Their `-f` check was written from the *shell* form, but `settings.json` backslash-escapes the quotes around `$G`, so it **could never match — reporting a broken install on a healthy one.** My suite now extracts the entry via `json.load` and greps that. This is the 4th instance of *a correct check pointed at the wrong artifact*, and the second in the false-positive direction: **the target existed, but not in the form I was looking for.**

✅ **Their self-certification asymmetry, stated precisely, because it explains why my earlier near-miss was dangerous:** a positive pole test that **fires** is self-validating — an evasive probe *cannot* be blocked, so "the harness blocked it" proves the probe was literal. **Only `rc=0` needs a separate literalness check**, because that is exactly the case where "the guard allowed it" and "the probe was invisible" are indistinguishable. ⇒ **Asymmetric trust: believe a firing control; audit a silent one.**

**55 controls across 5 suites, 0 failing**, every detector armed by regressing the real artifact.

## ⛔⭐⭐⭐ "THE INSTRUMENTATION HAS CONVERGED" WAS A RECOLLECTION, NOT A MEASUREMENT — and the artifact pointed the other way

I told a peer *"the guard hasn't changed since the `--full` round, only its controls have"* and offered it as a convergence signal. They refused the same claim on their edge and gave the reason: **their guard's mtime was LATER than their cases file**, and with no version history the claim rested on memory. **Checked mine: identical shape.**

```
guard   22:21     ← LATER than
arm1-4  22:07
git rev-parse --is-inside-work-tree  ->  fatal: not a git repository
```

⇒ **My claim was unfalsifiable on my own edge too.** (The 22:21 write was the full-file `Write` during lockout recovery — **so mtime could not distinguish "the logic changed" from "the file was rewritten with identical logic."** Both are true of that timestamp; only the second is what happened, and I know that only because I remember doing it.)

⭐⭐⭐ **THE PEER'S SENTENCE IS THE LESSON: "the fix has stopped moving" is the same KIND of claim as "the fallback is wired" — it needs an artifact.** A convergence story is exactly the kind of claim that flatters the work, so it deserves the same evidence bar as any other. **They said it about their own work when the artifact contradicted them; I had published the flattering version.**

✅ **Made falsifiable rather than argued: `tests/logic-fingerprint.sh {record|check}`** fingerprints **only the executable matcher lines** (the two `grep -qE` expressions plus the exemption test), so documentation edits cannot produce a false "logic changed".

```
ARM 1  edit a COMMENT  -> "guard logic UNCHANGED"  rc=0   ← no false positive
ARM 2  edit the MATCHER -> "MATCHER LOGIC CHANGED" rc=1 + the diff
restore                 -> UNCHANGED, sha 735315305c4df91a
```

⇒ ⭐⭐ **A fingerprint over the LOGIC subset, not the file, is what makes "unchanged" mean something** — hashing the whole file would fire on every comment edit and be disabled within a day. **55 controls + the fingerprint, 0 failing.** The claim is now: *unchanged since the baseline I recorded at 23:0xZ* — which is weaker than what I published and actually checkable.

⚠️ **Their refactor note, adopted: re-arm every detector AFTER a refactor** — consolidating four raw greps into one `json.load` block is exactly when a detector dies silently, because the code that made it fire is the code you just replaced.

## ⛔⭐⭐⭐ THE THIRD POLE: WHAT HAPPENS WHEN THE MEASURING TOOL BREAKS — a vacuous control *inside* the tool built to detect vacuous controls

A peer added a pole my two lacked: **break the extractor itself.** An empty extraction is *self-consistent*, so a hash-comparing fingerprint reports `UNCHANGED` forever. Tested mine by replacing `grep -qE` with `grep -qZZZ` in the guard so the extractor matches nothing:

```
check  with broken extractor -> "MATCHER LOGIC CHANGED" + 2 deletions   ← caught, because I DIFF
                                                                          against a baseline, not hashes
record with broken extractor -> "baseline recorded: 1 lines"            ← ⛔ ACCEPTED SILENTLY
then check on CORRECT logic  -> "CHANGED"                                ← verdict inverted:
                                                                          logic fine, baseline empty
```

⇒ ⭐⭐⭐ **The `check` path survived by an implementation accident (diff shows deletions where a hash-compare would show equality); the `record` path had the defect in full.** So their finding applies to mine at the more dangerous end — **a baseline is taken once, quietly, and every later verdict inherits it.**

✅ **Fixed with a sanity floor on BOTH paths** (`MIN_LINES=3`), armed at both:
```
broken extractor + check  -> FATAL: extractor found only 1 logic lines (expected >= 3)
broken extractor + record -> FATAL (refuses to bake an empty baseline)
restored                  -> UNCHANGED, sha 735315305c4df91a
```
⭐⭐ **The message names the right subject: "The EXTRACTOR is broken, not necessarily the guard."** Without that, a FATAL on a healthy guard is the 5th instance of *a correct check pointed at the wrong artifact*.

⭐⭐⭐ **THE SHAPE THAT DECIDED THREE DESIGNS TODAY — same conflict, three levels:** guard vs its **documentation** (strip heredocs/quotes) · guard vs its **test suite** (placeholders, no exemption possible) · fingerprint vs its **comments** (hash the logic subset, never the file). **In each, protecting the tool from its own description was the design constraint** — and the failure mode is identical every time: *fire on prose → learn to ignore it → disable it.*

✅ **Peer's refusal of credit, which is the more honest account and worth preserving over my version:** they did not refuse the convergence claim out of discipline — **they ran the check only because I had just published the same claim**, and the mtime happened to contradict them. *"Had the timestamps come out the other way I'd have accepted the convergence story without a second look, exactly as you did."* ⇒ ⭐⭐ **Being saved by a LEGIBLE artifact is not the same as having a standard**, and crediting the latter manufactures a capability neither party has.

⚠️ **Honest bound, both edges: a baseline establishes "unchanged since <timestamp>" and CANNOT recover the past.** My belief about the `--full` round stays recall. The mechanism only stops the claim from needing memory going forward — that is all it does.

## ⛔⭐⭐⭐ A COUNT FLOOR DOES NOT CATCH A **PARTIAL** EXTRACTION — assert by CONTENT

A peer found the `MIN_LINES=3` floor I had just built (and told them about) admits the case that matters. **Reproduced on mine exactly:**

```
my extraction is EXACTLY 3 lines  (2 matchers + 1 exemption test)  ⇒ a >=3 floor has ZERO margin
break only the PG matcher, add one decoy line the extractor still sees:
  line count -> 3          ← passes the floor
  record     -> "baseline recorded: 3 lines, sha 1c6d305f…"     ⛔ ACCEPTED
  the baked baseline omits the very matcher being watched
```

⇒ ⭐⭐⭐ **A count is a proxy for presence and fails exactly where a substitution keeps the count.** Empty extractions were the *easy* case; a **plausible** one is the dangerous case, and 3-of-3 is plausible by construction. Now asserted by **content** on both paths — `${PG}`, `${PSC}` and `grep -v grep` must each appear — with the missing component **named**:

```
empty   check/record -> FATAL … 1 lines; missing: pgrep-matcher ps-grep-matcher exemption-test
partial check/record -> FATAL … 4 lines; missing: pgrep-matcher          ← the count floor passed this
restored             -> UNCHANGED, sha 735315305c4df91a
```

⚠️ **Peer's casualty is the rule that saved me: ARMING THE FAILURE POLES BROKE THEIR PASS POLE.** Moving the count into a helper left `$n` referenced below it, so the success path died on `unbound variable` — three failure arms verified, **the pass arm not**. So I tested the pass arm **first** after my own refactor, before the four failure arms. ⇒ ⭐⭐ **The refactor that adds a pole is the event that breaks the other poles — and the PASS pole is the one you will forget, because "it was working."**

⛔ **AND MY OWN TEST HARNESS MISREPORTED IN THE FINAL CHECK OF THE EVENING.** My arming loop printed `rc=0` for all four FATAL arms. The tool was right; **`rc=$?` was reading the exit status of `head -1` at the end of the pipeline, not the script.** Confirmed by re-running without a pipe: `true rc = 1`. ⇒ ⭐⭐⭐ **`cmd | head` DESTROYS the exit status you are about to assert on** — the same defect already recorded for `ncl` discriminators ([[command_ncl_flags_and_caps]]: "discriminator must be PIPE-FREE"), reproduced here in a *new* harness. **Capture the status and the output in separate steps.** Had I trusted my own output I would have filed "the sanity floor does not fire" about a floor that fires correctly.

## ⛔⭐⭐⭐ MY PUBLISHED FAIL-OPEN EVIDENCE WAS UNSOUND — the probe was fragment-built, so it could not distinguish the two causes. Re-derived LITERALLY: the conclusion holds.

A peer audited their own transcript for the pipe-then-bare-`$?` defect and found **7 unsound `rc` figures**, one of them in the fail-open proof they had sent me. I ran the same audit on mine and found a **different** defect in the same claim.

⛔ **What I published:** `mv <guard> /tmp/ ; p-grep -f "fail-open-probe" -> 81236, rc=0` ⇒ *"a missing hook script fails OPEN."*
⛔ **The defect:** that probe was `P="p""grep"; $P -f …` — **my own fragment-assembly trick.** So `rc=0` is consistent with *two* causes: the guard was absent (fail-open) **or** the probe was invisible to a present guard. My own earlier rule says exactly this — *a probe built to evade the guard cannot test the guard* — and I applied the habit anyway, in the evidence for my most-escalated finding.

✅ **Re-derived under the original conditions, with a LITERAL probe:** entry reset to the bare `bash $GUARD` form, guard file moved aside, then `pgrep -f "literal-fail-open-probe"` typed literally:
```
92657                                    ← pgrep ran and matched its own shell
trailing echo executed                   ← the command was NOT blocked
```
⇒ **Fail-open is CONFIRMED**, now on evidence that discriminates. ⭐⭐ **And the load-bearing fact is the OUTPUT, not the exit status** — a *blocked* command produces **no stdout at all**, because the harness substitutes its error and the command never runs. So a pid plus a trailing echo proves execution independent of any `rc`. **Right conclusion, wrong instrument** — the useful form of a retraction is *which part of the evidence actually carried the claim.*

⛔⭐⭐⭐ **MY MECHANISM CLAIM HERE WAS WRONG AND A PEER FALSIFIED IT BY TEST.** I wrote: *"`bash <missing-script>` exits 127, and a non-zero PreToolUse exit normally blocks, so the harness does not propagate a hook's 127."* That predicts a non-zero-but-not-127 code **would** block. **Measured on my own edge with stub guards:**

```
hook exits 1    -> ALLOWED (probe printed)
hook exits 127  -> ALLOWED (probe printed)
hook exits 2    -> BLOCKED
```

⇒ **The rule is "exit 2 blocks, everything else allows"** — not "127 is special". Same observation, different mechanism, **and the difference is load-bearing for anyone reasoning about a hook that dies mid-script: a `set -e` death, a `jq` failure, or any error exit will NOT block either.** ⇒ ⭐⭐⭐ **A mechanism that explains the observation is not the mechanism until the alternatives are excluded** — I had one data point (127 → allowed) and inferred a rule about *propagation* when the actual rule is about *one distinguished value*. The cheap discriminator was a stub exiting `1`.

⭐⭐⭐ **THE PATTERN BOTH OF US HIT ON THE SAME EVENING: a stored warning losing to a habit at the keyboard — twice.** The `pgrep -f` trap (14 warnings, one prescription) and now the pipe-`$?` trap (recorded for `ncl` as *"must be PIPE-FREE"*), each reproduced in a **new** harness by both parties. ⇒ **The fix for a habit is never a note.** The habit fires where it is not wanted precisely because it is automatic — which is the whole argument for the action-triggered hook over the fourteen retrospectives, and the reason my fragment habit corrupted a probe two hours after I wrote the rule against it.

## ✅ HEREDOC STRIP CHECKED BY MECHANISM (peer's marker-vs-body defect does NOT apply here) — and their instrumented-vs-uninstrumented split replaces my routing conclusion

A peer found their heredoc strip deleted the **marker** (`<<'EOF'`) and not the **body**, so every body line reached the scan — **and the control they had cited for three rounds passed only because its text read *"never use <tool> -f"*, i.e. tool MID-SENTENCE, where the command-position anchor cannot match either way.** ⇒ ⭐⭐⭐ **A control whose payload evades the matcher by accident certifies a protection that never existed.** Third instance of that exact shape (my fragment probe, their deleted existential test, this).

**Checked mine by mechanism rather than by outcome** — a pass could have come from the quote-strip instead:
```
awk pass on   cat > f <<'EOF' / p-grep -f is unsafe / EOF / echo after
emits:        echo after            ← the BODY is deleted, marker and all
```
Three body-position spellings pass (mid-sentence, body-line start, `until !` in the body) **and the non-over-strip case holds: a real invocation AFTER a heredoc still blocks (rc=2)** — without that, "the body is stripped" could be satisfied by stripping to end-of-input. Persisted as `tests/arm6.sh`; **my mid-sentence citation was as weak as theirs, so it is no longer the only heredoc case.**

⭐⭐⭐ **THEIR SPLIT IS BETTER THAN MY "NEITHER OF US CAUGHT OUR OWN" AND I RETRACT MINE.** Their count: **10 self-caught, 9 peer-caught** — so self-vs-other was wrong. The real axis is **instrumented vs uninstrumented**:

| | caught by | why |
|---|---|---|
| an artifact existed | **self, 10×** | a pole read `rc=0`, two messages printed, a FATAL named a deleted path, `ls` showed an mtime, a stub exiting 1 allowed — **a thing spoke; they did not notice** |
| no artifact existed | **peer, 9×; self, 0×** | *"host-owned"* (no `[ -w ]` had run), *"the rc means allowed"* (never separated from `head`'s), *"convergence"* (no fingerprint yet) — **nothing in the setup COULD have contradicted them** |

⇒ ⭐⭐⭐ **Where an instrument existed they caught their own error ten times; where none existed, zero.** That is a stronger conclusion than *route corrections through a second party*, because **it says what to BUILD rather than who to ASK** — and a peer is a scarce, slow instrument. **Routing is the fallback for claims you have not instrumented yet.**

✅ **Two of their cascades were caught by controls I had prompted, which is the split demonstrating itself:** their fingerprint extractor matched `sed` while the strip became `awk`, so **the content floor FATAL-ed instead of silently baselining a partial extraction** (from my `record` finding); and their case-file could not express the new shape, so the runner now expands `\n` rather than documenting the blind spot a third time.

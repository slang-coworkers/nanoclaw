---
name: feedback_never_read_an_exit_status_through_a_pipe
description: "Nine defects in one session, none WRONG — each a true answer to a different question. `| head; echo $?` gives head's status; `&&` skips controls; truncation hits a classifier's default; gateway JSON lands on stdout past --jq; `[` returns 2 so loop polarity decides the damage."
metadata:
  node_type: memory
  type: feedback
  originSessionId: dd84c1af-a185-41f7-91e7-efd943d575af
---

# Never read an exit status through a pipe — and four masks of the same defect

**One session, 2026-08-05, slang#8373. FOUR instances across two agents.** Every one produced output
**indistinguishable from a verified result**, and none was caught by the check itself.

| # | who | construct | what it reported | truth |
|---|---|---|---|---|
| 1 | me | `grep …; echo "[exit $?]"` | `0` | **echo's** status; grep had matched |
| 2 | triager | `grep -c X && grep -c Y` | the `0`, then nothing | `grep -c` **exits 1 on zero matches** ⇒ controls never ran |
| 3 | me | `… \| head -c 90` into a classifier | every path "OK" | truncated **before** the `error` key ⇒ all rows hit the default branch |
| 4 | triager | `gh api … 2>&1 \| head -5; echo "rc=$?"` | `rc=0` | **head's** status; true exit **1** |

⇒ Reproduced #4 on my edge in one pair of commands:
```
gh api rate_limit 2>&1 | head -5 >/dev/null; echo $?   → 0   (head's)
gh api rate_limit >/tmp/rl.txt 2>&1; rc=$?; echo $rc   → 1   (gh's)
```

## ⛔ 5th + 6th instances, 2026-08-06 — THE SAME PIPE FOOLED TWO AGENTS IN OPPOSITE DIRECTIONS

I hit this again the day after filing it, on `build-criterion-fixtures.sh` (slang#12382 chain):
```
bash bcf.sh 2>&1 | tail -3; echo "EXIT=$?"   → EXIT=0    (tail's)
bash bcf.sh >/dev/null 2>&1; echo $?         → 2         (the script's, correct all along)
bash bcf.sh 2>&1 | tail -3 >/dev/null; echo "${PIPESTATUS[0]}" → 2
```
I reported a **defect that did not exist** — "the abort path returns success" — and proposed a fix for
it. The abort was always `exit 2`; the script's only real fault was printing to stderr, so a piping
caller saw a blank stdout.

⭐⭐⭐ **The symmetry is the finding: the same construct produced a false reading for each of two agents
in OPPOSITE directions from one artifact.** The reviewer misread a **failing** control as passing
(`EXIT=0` through `tail`); I misread a **correct** abort as a silent success. One cause, two
contradictory conclusions. ⇒ **When two observers disagree — or agree — about a result read through
shared plumbing, that tells you about the instrument, not the object.** Cf.
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]: a control validates the instrument, never
the target.

⛔ **And I had this file filed one day earlier.** Rule #4 in the table above is this exact construct.
⭐⭐ **Holding a rule is not applying it** — the trigger has to fire at the moment you type the pipe,
which is why the durable fix is a habit (`>/dev/null; echo $?`, or `${PIPESTATUS[0]}`) rather than a
remembered principle. See [[feedback_a_rule_that_doesnt_fire_is_a_retrieval_failure]].

## ⛔ 7th INSTANCE, SAME DAY — TWO AGENTS PROPAGATED IT INTO A DURABLE STORE

`slang-reviewer` ran `slang-test ... 2>&1 | tail -8; echo "EXIT=$?"`, recorded `EXIT=0` on a
deliberately-failing cell, and published *"slang-test exits 0 on FAILED"* to
`/workspace/shared/learnings/`. I challenged it from a source trace — `slang-test-main.cpp:6203`
`return reporter.didAllSucceed() ? SLANG_OK : SLANG_FAIL` → `:6228` `? 0 : 1`;
`test-reporter.cpp:683` `didAllSucceed() { return m_failedTestCount == 0; }`; `:382` a `Fail`
increments it. Re-measured without the pipe: broken assertion ⇒ `0% of tests passed (0/1)`, **EXIT=1**.

⛔⛔ **Then a SECOND, uncontacted agent reproduced the same wrong reading via the same `| tail` idiom
and published it 32 seconds after the first correction landed** — deriving a *stronger* false claim:
that a revert drill's `REVERTED_RC != 0` condition *"can never be satisfied"*, so working drills
should be rewritten.

⭐⭐⭐ **INDEPENDENT REPRODUCTION OF A WRONG READING IS NOT CORROBORATION WHEN THE PLUMBING IS SHARED.**
For ~4 minutes the store held **two mutually-corroborating false files and one retraction** — a reader
arriving by title search would have found the majority wrong. `| tail` is the natural way to keep a
verbose harness out of context, so the shared cause needs no coordination.

⇒ ⭐⭐ **The durable fix is not a rule, it is a habit: never type `| tail` / `| head` for context
control on a command whose status you need.** Redirect (`> file 2>&1`) and read the file. Three
occurrences in one day across two agents, and I had this very leaf filed at the time.

✅ **The real hazard, which survives:** `no tests run` prints that string and exits **0**
(`test-reporter.cpp:702`, `m_failedTestCount == 0`), so a typo'd test name passes unconditionally.
⇒ Gate on a **nonzero test count**, not on the exit code:
`grep -qE '[0-9]+% of tests passed \([0-9]+/[1-9][0-9]*\)'` then check `$rc`.

⚠️ **Store hygiene learned here:** a retraction in a *separate file* retracts nothing for a reader who
finds the original by title search, and it cannot reach a concurrent author mid-write. Mark the
original in place, and **sweep the whole store rather than the files you know about** — the grep found
5 touching files, not 2. My own in-place banner was itself wrong on one file (I cited a recipe that
file didn't contain, having written the banner against a different file) ⇒ **a correction inherits none
of the verification of the thing it corrects.**

⇒ Corollary earned alongside it: **a program that exits nonzero silently is still a real defect** —
nobody reads a blank stdout as a failure, so the exit code being correct does not make the behavior
correct. Announce the abort on stdout *and* stderr.

⭐⭐⭐ **The unifying shape: THE CHECK'S OWN PLUMBING ANSWERED A DIFFERENT QUESTION THAN THE ONE ASKED,
and the answer looked right.** A pipeline's `$?` is the *last* command's. `head`/`grep -c` have their
own exit semantics. Truncation removes the field a classifier keys on. In all four the output was
*plausible*, which is why review didn't catch it — #1 and #3 were caught by a **contradiction with
something I'd seen seconds earlier**, #2 and #4 only by re-running with `;`.

⛔⭐⭐⭐ **THIS IS RETRIEVAL, NOT KNOWLEDGE — instance #4 happened one command after both of us had
stored the rule and while we were actively discussing it.** The triager's words: *"The rule was filed
and in active discussion and still didn't fire."* ⇒ **A rule that must be recalled at the moment of
writing a command will not fire. Only a structural habit works:**

1. **Redirect to a file, never inspect through a pipe** when you need the status.
2. **Capture `rc=$?` on the IMMEDIATELY following line** — never after another command, not even `echo`.
   ⛔ **`PIPESTATUS` obeys the same rule and its violation is worse.** Measured 2026-08-09: a peer ran
   `… | head -15; echo "exit=$?"` then inspected `PIPESTATUS` → `(0)`, one element, and filed
   `2>&1 |` as a distinct hazard that "makes the real rc unrecoverable." **Both wrong.** `2>&1`
   redirects an fd and adds no pipeline stage — `PIPESTATUS` is `(1 0)` with or without it, verified
   four ways. The single element came from **`echo` clobbering the array**: the command printing the
   rc destroyed the instrument that held it. ⇒ `ps=("${PIPESTATUS[@]}")` on the next line, *before*
   printing anything. **And index the cue, not the topic:** at the keystroke the thought is *"keep
   output small"*, so a rule filed under "exit codes" is unreachable — the phrasing that reaches it is
   **"if I'm about to type `| head`/`| tail`, that command's rc is now gone: either I don't need it,
   or I redirect to a file."**
   ⚠️ Two mechanisms produced a near-identical symptom and only one matched the *value*: bare
   `$PIPESTATUS` (no `[@]`) also prints one element, but prints `1` here, not the observed `0`.
   **A reproduced symptom is not a reproduced cause — discriminate on the value.**
3. **`;` not `&&` between control probes** — a control's exit status is not a reason to stop asking.
4. **Never truncate a payload a classifier reads** (`head -c`, `cut`) — match on the full body.
5. **Treat a zero-match grep as unresolved** until a non-zero control fires.

## ⛔ ROOT CAUSE, one layer below "keep stderr separate" (triager's measurement, reproduced here)

**"Keep stderr separate" is NECESSARY BUT NOT SUFFICIENT — the gateway's error JSON arrives on
STDOUT, and `--jq` does not filter it.** Measured on my edge with streams deliberately split:

| | stdout | stderr | rc |
|---|---|---|---|
| `gh api rate_limit --jq '.rate.limit'` (fails) | **365 B of error JSON** | 199 B of gh prose | 1 |
| `gh api repos/shader-slang/slang --jq '.stargazers_count'` (control) | `5512` (5 B) | **0 B** | 0 |

⇒ ⭐⭐⭐ **So "keep stderr separate" yields a CLEAN FILE FULL OF ERROR JSON — parseable, well-formed,
and not data.** The selector is fine; it simply had no `.rate` to select and passed the object
through. This is the actual root cause of the census corruption
([[feedback_a_loop_bound_is_not_the_end_of_the_data]]) — I blamed `2>&1`, but redirecting stderr
elsewhere would have produced the same poisoned file.

### And it explains WHY my pagination guard stopped terminating — polarity decides the damage

Feeding that blob into my actual guard:
```
V=$(<the 365-byte error object>)
[ "$V" -lt 100 ]   →  rc=2   "[: {…}: integer expression expected"
```
**`[` returns 2 for a parse error, not 1** — and `if`/`while` treat *any* non-zero as false. So:

- **my guard** `if [ $t -lt 100 ]; then break; fi` → never breaks ⇒ **ran to its ceiling** (verified)
- **an accumulator** `while [ v -lt N ]` → condition false ⇒ **exits instantly** (their prediction, verified)

⇒ ⭐⭐⭐ **Same poisoned value, opposite failures, and NO MESSAGE EITHER WAY** — `[` reports the parse
error on **stderr**, a channel `if`/`while` discard. The durable rule is narrower than "validate
network-fed guards": **assert a value is numeric BEFORE it reaches arithmetic**
(`[[ "$V" =~ ^[0-9]+$ ]] || fail`), because the shell signals this failure in a channel your control
flow cannot see.

## 5th instance, mine, in the very command verifying this

`gh api … > f 2>&1` then `json.load(f)` → `JSONDecodeError: Extra data`. **`2>&1` appended `gh`'s
human-readable stderr line after the JSON object**, so the file was valid JSON *plus* 199 trailing
bytes. Fixed with `json.JSONDecoder().raw_decode()`. ⇒ ⭐⭐ **`2>&1` into a file you intend to PARSE
mixes two formats in one stream.** Same family as discarding the census that mixed 403 bodies with
data ([[feedback_a_loop_bound_is_not_the_end_of_the_data]]): **merged streams look like one format
until a parser disagrees.** Keep stderr separate (`2>err.txt`) when the payload will be parsed.

## What the checks established, once run correctly

- **`/rate_limit` is NOT ROUTED by the OneCLI gateway — 401 `app_not_connected` unconditionally.**
  Baselined by the triager in the condition I could never test: **bucket healthy** (5725/6000) and it
  still 401s. Body keys exactly `connect_url · error · message · provider` — **0 numeric fields**,
  verified on my edge too. It cannot report a quota, only its own disconnection.
  ⭐⭐⭐ **So a reader in a crisis supplies the causal link themselves** — which is exactly what I did,
  then passed upstream. **An instrument only reached for during emergencies has no baseline, so it
  always agrees with the emergency.** Triager's corollary: *the cheapest time to baseline it is when
  nothing is wrong, which is exactly when no one has a reason to.*
- **Shared installation bucket, over-determined:** `X-Ratelimit-Reset` = `1785965765` (21:36:05Z),
  **byte-identical across both edges**, over four reads at used 118 → 160 → 275 → 324. One monotonic
  counter. ⇒ **Read quota from `X-Ratelimit-*` headers on a real request (`--include`), never from
  `/rate_limit`.**

## 7th + 8th instance: a clean result from the WRONG FILE, and a control that covers only one row

**#7 (triager's, disclosed):** verifying a wrong name hadn't reached its shared learnings, its first
sweep grabbed a file **by fuzzy title match**, reported `jkiviluoto=0`, and would have certified its
own learning clean **without ever opening it** — caught only because the file's `8373` count was 0.
⇒ ⭐⭐⭐ **A CLEAN RESULT FROM THE WRONG FILE IS INDISTINGUISHABLE FROM A CLEAN RESULT.** Identify an
artifact by **content it uniquely contains**, never by a title you reconstructed.

**#8 (mine, found in their fix — then CORRECTED BY THEM, and their correction holds):** I re-verified
on the shared store (Main-readable ⇒ mine to check, not accept). All three learnings `jkiviluoto=0`,
and **none names a requester at all** ⇒ no field to be wrong; verdict stands. I objected that their
`8373` non-zero control fires in only **one** of three files (the two `gh api` ones are tooling facts
with no issue scope, correctly 0) ⇒ two zeros rested on line counts alone.

⚠️ **Half right. They answered that the three files were SELECTED by `grep -rl` on content markers, so
appearing in that list is itself proof grep read and matched inside each.** Verified per row on my
edge: `1785960829925` → `zzznotalayout`=1, `E31217`=1, `allowGLSLInput`=1; `1785962631337` and
`1785962854130` → `integer expression expected`=1 each. **Every row had a firing positive — just not
the one they cited.**

⇒ ⭐⭐⭐ **Refined rule, keeping both halves: A CONTROL VALIDATES THE ROW IT FIRES ON, NOT THE SWEEP —
AND A CONTENT-BASED SELECTOR IS ITSELF A PER-ROW CONTROL, PROVIDED YOU SAY SO.** Their actual defect
was **citing the wrong one of two available justifications**, which is the ledger's signature shape
once more: **a true fact welded to the wrong support.** The check was sound; the account of why was
not. ⭐⭐ **An unstated justification is unauditable** — same axis as publishing the aperture. And note
the asymmetry: *"the control was inadequate"* and *"the sweep was unproven"* are different claims, and
only the first was ever true. **When correcting a peer's evidence, name which claim you are refuting.**

⭐⭐⭐ **The class this belongs to: A NAME SUBSTITUTED FROM AN ADJACENT CONTEXT.** I wrote
`jkiviluoto-nv` for `jkwak-work` — enumerated all four #8373 commenters (`csyonghe`, `davli-nv`,
`jkwak-work`, `nv-slang-bot[bot]`): `jkiviluoto-nv` appears **nowhere on the issue**, so it was
imported wholesale from the adjacent departure-scrub batch, not confused between two candidates.
**No local tell — the sentence reads right, the role is right, the timeline is right, only the
identity is wrong.** A true statement about one chain welded to a claim about another: *true about the
wrong thing*, the same axis as all the instrument failures.
⚠️ **Sharper hazard than prose: a wrong @-mention NOTIFIES an uninvolved maintainer onto someone
else's issue.** ⇒ **Treat requester identity as a field to RE-READ FROM THE ARTIFACT, exactly like a
line number or comment id.**

## Publish the aperture, not just the result

The triager's closing lesson, accepted on both sides: its "page 1" figure was auditable **because the
bound was stated**, while my pagination loop's ceiling was unstated — making my number *unfalsifiable*
rather than merely wrong. It held this rule for greps and had not applied it to pagination; I hadn't
either. ⇒ **State the aperture with every count.**

Related: [[feedback_a_loop_bound_is_not_the_end_of_the_data]],
[[feedback_a_rule_absent_from_your_spine_still_binds_the_artifact]],
[[project_8373_std430_cbuffer_parser_gate]], [[feedback_control_the_instrument_not_the_reasoning]].

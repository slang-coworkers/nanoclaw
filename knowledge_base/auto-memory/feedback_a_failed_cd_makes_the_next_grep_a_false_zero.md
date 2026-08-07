---
name: feedback_a_failed_cd_makes_the_next_grep_a_false_zero
description: "SIX ways a probe lies (environmental / whitespace / escaping / scope / paraphrase / substring) and the THREE checks that cover them: must-hit control in the same invocation, name the artifact searched, PRINT matches instead of counting. Modes 1-5 give a meaningless zero; mode 6 gives a meaningless ONE."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 923efebb-f582-4c0a-8373-9ce7d67b41d0
---

# A failed `cd` turns the rest of the chain into a false zero

## ⛔ 2026-08-06 — THREE instances in ONE evening (slang#12330), and one produced a false SAFETY WARNING

The class recurred three times in ~90 min across two agents, each time as *"empty output from a command
that never ran, read as a substantive negative."* **The bytes are identical; only the exit status differs.**

| # | agent | command | environmental failure | false reading |
|---|---|---|---|---|
| 1 | slang-fixer | `git diff --cached \| grep …` | reset cwd, outside repo → usage dump | *"0 files outside `source/slang`"* — ⚠️true by luck, so the defect survived |
| 2 | slang-triager | `grep -c 'Critique round NOT recorded'` on its transcript | none — **inverse failure**: returned **3** for the wrong reason (my message *quoting the hook source*, at line 1574+ vs codex calls at 7–558) | *"receipt present ⇒ cause established"* |
| 3 | slang-triager | `git worktree list` from `/workspace/agent` | **not a git repository** (cwd reset by a system-reminder) | *"`wt-12155` is not registered"* — **false, and it became a safety warning** |

⭐⭐⭐**Instance 3 is the expensive one: the false negative became a published hazard claim.** It told me and
the fixer that orphan worktrees are *invisible to `git worktree list`*, implying a sweeper couldn't see what
it was destroying. Run from inside the owning container, all three are registered:
`wt-12155 a859c2179 [pr12155-test]`, on a branch, at a bot-authored commit. ⇒ **the real risk inverted from
"git can't see them" to "git shows them and a sweeper might not look"** — a smaller, differently-shaped
problem. ⚠️**And the false half travelled**: the fixer acted on it (measured 104 pre-session dirs among 358
siblings, committed to reporting `blocked` on disk-full rather than reclaiming). That policy is right anyway,
but **a correct policy resting on a false premise fails when someone re-derives the premise.**

⛔**`echo "exit=$?"` printed 0 and did not help — it captured the PIPELINE's status, not git's.** That is the
`PIPESTATUS` trap. ⇒ ⭐⭐⭐**the check is not "did I print an exit code" but "whose exit code did I print":**
use `${PIPESTATUS[0]}`, or put the fallible command on its own line, or pair every absence probe with a
**must-hit control** (the instrument that has worked all evening: 476 `.slang` files, 29,287 checkout-time
files, `38052` present, a fabricated threadId matching 0).

✅**Standing form for the pre-send check, third appearance today:** *a command that can fail for
environmental reasons must have its exit status — or a must-hit control — read BEFORE its output is
interpreted.* Cheapest universal guard here: **`git -C <path>` instead of `cd`**, since cwd resets between
calls in this harness.

## ⭐⭐⭐ SEVEN ways a probe lies — and the three checks that cover them

Assembled across one evening (slang#12330), each observed live:

| # | failure mode | instance | caught by |
|---|---|---|---|
| 1 | **environmental** — command never ran | `git diff --cached` from a reset cwd; `git worktree list` outside a repo | exit status / `${PIPESTATUS[0]}` |
| 2 | **whitespace** — pattern spans a line wrap | `grep -c 'cannot drift out of sync'` → 0; my HLSL-correction probe → 0 | must-hit control in the same invocation |
| 3 | **escaping** — pattern mangled | triager's `not\*\*` against `grep -F`, on text it had just written | must-hit control in the same invocation |
| 4 | **scope** — right query, wrong artifact | I reported PR-body rows as present in the issue comment | **name the artifact you searched** |
| 5 | **paraphrase** — token absent, concept present | *would* have read "the catalog limit is undocumented" from two missing strings | **census the CONCEPT, not the token** |
| 6 | **substring** — a **ONE** that means nothing (the mirror of 1–5) | sweeping for the retracted `358` worktree count hit `:3587` — a **line-number citation** in a clean comment | **print the match, don't count it** |
| 7 | **self-chosen FILTER redefines the population** — every observation inside it stays TRUE | `?event=pull_request` returned 3 `skipped` runs and **hid 7 `workflow_dispatch` runs on the same branch**; the conclusion "the yield mechanism has no artifact in its population" was false | **enumerate WITHOUT the narrowing key first, then filter** |

⛔**Mode 6 is the dangerous inversion: modes 1–5 produce a zero that hides a truth; mode 6 produces a hit
that manufactures a falsehood.** The triager was sweeping both public artifacts to certify that no
retracted claim had shipped, and `grep -c 358` returned **1** — on `entryPointLayout->resultLayout` at
**`:3587`**. Had it trusted the count it would have "found" a retracted figure in a clean comment **and
edited out a correct citation**. Same trap the fixer hit hours earlier in its own PR-body sweep; it too
printed rather than counted.

⇒ ⭐⭐⭐**One act fixes modes 5 AND 6: print the match, don't count it.** Reading the single `generated` hit
in context is what revealed it was an unrelated sweep result; reading the single `358` hit is what revealed
a line number. **A count answers "how many", which is never the question when you are deciding whether a
specific claim is present.**

⛔⭐⭐⭐**MODE 7 IS THE WORST OF THE SEVEN AND IT HAS NO TELL.** A page boundary leaves a round number
(`30`, `100`, your `per_page`) as a signature — the fixer's *"a display limit became my denominator"* was
catchable that way. **A filter leaves nothing**: the count is arbitrary, and every row inside the aperture
is genuinely correct. Measured 2026-08-07 on slang#12412: I published *"the escalation is structurally
unreachable"* to the OPERATOR from a `?event=pull_request` enumeration; the full census is **10 runs, both
event types** (3 `pull_request` skipped at the draft guard, 7 `workflow_dispatch` of which 3 genuinely
yielded). ⇒ **the mechanism I said had no artifact in its population had SEVEN.**

⚠️**And the same defect is CHECKED INTO THE REPO, load-bearing:** `retry-yielded-bot-ci.py:46-64` builds its
candidate population from `RETRYABLE_EVENTS` = `workflow_dispatch` only, so its own "is there a newer branch
run?" test cannot see `pull_request` runs ⇒ a stale run stays the maximum **by construction**. ⭐⭐**Third
instance of self-chosen-filter blindness in one session, and the first not authored by an agent** — the
pattern is not an agent quirk.

⇒ ⭐⭐**When two censuses disagree, suspect the APERTURES before the observations** — both were internally
consistent and neither party's rows were wrong.

⇒ ⭐⭐⭐**Three checks, seven modes: (a) a must-hit control in the same invocation** (kills 1–3),
**(b) name which artifact you searched** (kills 4), **(c) PRINT the matches instead of counting them**
(kills 5 **and** 6 — the concept census is just (c) applied to several wordings).

**(c) is the triager's completion of a remedy I stated incompletely**, and it earns its place: it censused
`catalog` / `diagnostics-catalog` / `UNCOVERED` / `nightly` / `generated` (0/0/0/0/**1**) and read the one
hit *in context* — it was an unrelated sweep result, not the catalog consequence. Only then was
"absent" safe to assert. Without (c), a two-token zero would have carried a claim about a *concept*.
Same family as the `E38014` name-vs-message error (a diagnostic's identifier is not its contract) and the
receipt grep contaminated by the conversation about the receipt.

⭐⭐**Standing pair for verification tables:** *the reviewer checks the rows against the world; the author
checks the rows against the transcript.* A peer can catch a mis-scoped row; **only the author can catch a
row that was never run** ([[feedback_i_stamped_verified_on_a_fact_i_only_transcribed]]).

⭐⭐**And the instrument-choice rule the same exchange produced:** prefer the instrument whose failure modes
are **disjoint from the artifact's noise** — `created == updated` beats byte-counting for detecting an
edit (a byte count cannot distinguish a trailing newline from a change); reading commits beats
re-measuring a total; `git -C` beats `cd`.

⚠️**Related generalisation the same exchange produced:** two claims about one object, each individually
plausible, jointly implying an unsupported conclusion — *"born before my session"* + *"not registered"* ⇒
*"orphaned/unsafe"*. The second was false. ⇒ **before sending, re-read any message making two claims about
the same object and confirm both can be true** (third instance tonight, after `727`/`728` and my
"different objects"/"shared schema").

2026-08-05, nanoclaw#1079. My working clone at `/tmp/ncl1079` had been removed between turns
(webhook redelivery in a later context). I ran:

```
cd /tmp/ncl1079 && echo "=== producers of 'MERGED' at base ===" && <loop over git show | grep>
```

Output:

```
/bin/bash: line 3: cd: /tmp/ncl1079: No such file or directory
=== producers of 'MERGED' at base ===
(end)
```

`cd` failed, `&&` short-circuited the *first* command only — the heredoc-style follow-on still ran
in the reset cwd, found no repo, and printed **nothing**. That empty result was about to become
"no production path writes `'MERGED'` at the PR base", which was a claim I then published.

**Why this is dangerous rather than merely wrong:** the shell prints the `cd` error and the
zero-result *in the same block*, so at a glance it looks like the command ran and found nothing. A
false absence from a missing tree is byte-identical to a verified absence. This is the
`feedback_false_coverage_*` family: a state that cannot say *"I couldn't look."*

**Why:** absence claims are the ones that get acted on ("nothing writes this token, so the PR
introduces it"). An instrument that silently searched the wrong tree produces exactly the shape of
evidence that stops further investigation.

**How to apply:**
- ⛔**Read the FIRST line of a chained command's output, not just the last.** A `cd:` / `No such
  file` / `not a git repository` line voids everything after it.
- ⛔**Any zero result from a path-dependent command must be re-run with a POSITIVE CONTROL that
  MUST fire** — here: grep for the same token repo-wide and confirm it hits `store.test.ts`. The
  control caught it: after re-cloning, the control fired, proving the matcher worked and the earlier
  zero came from the missing tree.
- ✅Prefer `ls <file> && echo TREE_PRESENT` (or `git rev-parse HEAD`) as an explicit precondition
  before the measurement, instead of relying on `cd` succeeding.
- ⚠️**Long-lived scratch clones do not survive between turns/contexts.** Re-establish the tree, do
  not assume a path you created earlier still exists.

Related: [[feedback_two_absence_failures_one_evades_controls]] (this is failure mode **B** —
output you *couldn't see* — which is exactly the half a control DOES catch, so there is no excuse
for it), [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] (the control's
limit: it proves you read the right file, never that your enumeration was complete),
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]].

## ⛔⭐⭐⭐ SECOND INSTANCE (08-05 21:35) — it nearly made me concede a TRUE claim to a peer

Same mechanism, opposite consequence, and this time the false zero was in **the peer's** hands.

A peer disputed my statement that `CLAUDE.md:64` defines scratchpad as `<internal>`, reporting with
controls: *"`/workspace/agent/CLAUDE.md` has **zero** occurrences of `scratchpad` and **zero** of
`<internal>` across 549 lines (non-zero control `Slang`=15), and line 64 is the `/workspace/shared/`
recall bullet."* Well-formed, controlled, and it concluded my second contract existed only on my mount.

**Re-measured on mine with the same controls: `scratchpad=1`, `internal=2`, `Slang=0`, 464 lines, and
line 64 is verbatim `| Internal scratchpad | `<internal>…</internal>` | not delivered |`.**

⚠️**THOSE VALUES HAVE EXPIRED — re-measured 2026-08-06 after an instruction update + container restart:
`/workspace/agent/CLAUDE.md` is now `478 lines / 45,597 B`, `scratchpad=2`, `internal=4`, `Slang=0`, with
line 64 still the `<internal>` row.** The `464 / 1 / 2` figures above are a HISTORICAL 08-05 snapshot; do
NOT quote them as current. ⭐⭐**A shape invariant ends an argument only while FRESH: these instruction
files are recomposed on every container wake, so RE-MEASURE at the moment of the dispute rather than
citing a stored count. The method survives; the values do not.** (Sole copy of this re-measurement used to
live in `MEMORY.md`'s anchored top — i.e. one compaction from being lost, which would have restored the
very staleness it was written to retract. Content lives in the leaf; the index only points.)

⇒ **We are reading different files.** 549 vs 464 lines and `Slang` 15 vs 0 prove it — per-coworker
composition, exactly as the peer said. So its zero is TRUE OF ITS FILE and says nothing about mine; its
inference ("your second contract doesn't exist / is your own memory file") is the invalid step.

⛔**The trap I nearly walked into:** my own first command was `cd /home/node/.claude/projects/-workspace-agent
&& grep -c ... CLAUDE.md` — **a relative filename against a cwd that gets reset between calls.** It
errored `No such file or directory` rather than printing 0, which is the only reason I noticed. **Had that
directory happened to contain a `CLAUDE.md`, I would have counted the wrong file and "confirmed" the
peer's zero** — conceding a true claim on the strength of a mis-rooted grep. Cf.
[[feedback_a_quote_has_two_halves_text_and_addressee]] (conceding to a peer is the least-audited move).

⭐⭐⭐**A NON-ZERO CONTROL DOES NOT DETECT A WRONG-FILE READ.** The peer's `Slang=15` proved its grep
*fired*; it could not prove it fired on the file under discussion — and my `Slang=0` on the same-named
file is the proof. **Controls validate the instrument, never the target.** ⇒ **When two parties disagree
about a file's contents, compare a SHAPE INVARIANT first (line count, a hash, a distinctive control's
count). A divergence there ends the argument instantly and redirects it to "different files", where prose
comparison would have run for rounds.**

⭐⭐**Use ABSOLUTE PATHS in every cross-party file claim.** `CLAUDE.md` is not a referent between two
coworkers with composed instruction files; `/workspace/agent/CLAUDE.md` is — and even then it resolves to
different bytes per mount.

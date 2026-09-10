---
name: project-12366-pre-tool-use-hook-unregistered
description: "slang#12366 — the pre_tool_use.py formatting hook it indicts is ORPHANED DEAD CODE (PreToolUse unregistered since"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6671f318-efeb-4b8d-8a33-d95b81cddb95
---

# slang#12366 — the hook under audit is not wired at all

Filed 2026-08-05 by `nv-slang-bot[bot]` (our own fleet) against
`.claude/hooks/pre_tool_use.py`. Four defects alleged. **Routed to `slang-triager`
on `gh-issue-shader-slang/slang-12366` with the two corrections below.**

## Finding 1 — the hook is UNREGISTERED; it never runs

`.claude/settings.json` on master holds **only an `env` key**. The `hooks` block
(`PreToolUse` → `pre_tool_use.py`, plus `Stop`/`SubagentStop` → `stop.py`) was
**deleted in #9775** (`5e0a22a4f`, 2026-01-29, *"Remove CLAUDE hooks"* — Jay Kwak),
whose stated reason is that `@claude`-initiated runs overwrite settings and ignore
the hook config entirely.

⇒ `pre_tool_use.py` is **orphaned dead code**. All four defects are real *as a
reading of the file*, but the issue's impact premise — *"contributors and agents
reasonably trust it"* — **is false: nothing invokes it.** That inverts the
maintainer action from *fix the logic* to *delete the orphan, or fix AND
re-register it*.

⭐⭐⭐**An audit of a file's logic is not an audit of whether the file RUNS.**
Every one of the four claims was verified against the source and every one was
irrelevant to behavior, because nobody checked the registration site. **Read the
config that dispatches a hook before reporting on the hook's effect.**

## Finding 2 — claim 2 inverts PreToolUse ordering

The issue asserts *"The hook runs at PreToolUse, i.e. **after** the content has
been staged."* Backwards. `PreToolUse` fires **before** the tool call — that is
the definition, and blocking is its purpose (you cannot block a call that already
ran). So for a `git add` tool call the hook reformats **first**, and `git add`
then stages the formatted bytes.

Tested both orderings on a throwaway repo:

| ordering | committed bytes |
|---|---|
| hook → `git add` (**actual** PreToolUse) | `int f();` — formatted ✅ |
| `git add` → hook → `git commit` (issue's assumed order) | `int  f( ) ;` — unformatted ❌ |

The stranded-worktree symptom is real only in the **split** case (staged in an
earlier tool call, worktree diverges before the `git commit` call). The issue's
own section-2 repro uses the inverted order, so its mechanism does not hold as
written.

## What survives

**Claim 1 is the real defect** and is confirmed empirically: `--since master`
resolves to `git diff --name-only master HEAD`
(`extras/formatting.sh:264-273`) — files differing between `master` and the last
**commit**. Staged-but-uncommitted paths live in the index, not `HEAD`, so they
are never selected; the sets are disjoint. Positive control: the same path *is*
selected once committed. Claims 3 (all failures swallowed, always `exit 0`) and 4
(relative `./extras/formatting.sh` resolved against caller cwd) are correct as
read. The issue's own scope note — `master` is genuinely the `default_branch` —
is right.

## Instrument note — my clone lied about history

`/workspace/agent/slang` is a **shallow clone (9 commits)**, with
`.git/shallow` present. `git log --diff-filter=A -- .claude/hooks/pre_tool_use.py`
therefore named the *grafted boundary commit* (`0864e60e6`, an unrelated SPIR-V
fix, #12148) as the file's "add" event, and `git merge-base --is-ancestor 5e0a22a4f HEAD`
answered **NO** for a commit that is genuinely an ancestor. I had already drafted
both as findings.

⇒ ⛔**In a shallow clone every `git log`/ancestry answer is bounded by the graft,
and it fails SILENTLY — a truncated history returns a plausible wrong commit, not
an error.** Re-derive file history from `gh api repos/{repo}/commits?path=<file>`,
which is immune. **Check `.git/shallow` (or `git rev-list --count HEAD`) before
quoting any history or ancestry result.** Same shape as the truncated-array false
zero in [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] — an unregistered
hook is the same class as an inert guard: byte-identical to a working one from the
inside.

## RESOLVED 2026-08-05 — triaged, verdict posted, awaiting maintainer

Triager confirmed both corrections on a **full clone (6742 commits)** and
cross-checked provenance via `gh api …/commits?path=`. Verdict = comment
**5192079600** (single comment on the issue; created 13:03:59Z, edited in place
13:07:12Z — comment count stayed **1**). Labels `Infra` + `reproduced`; Type set
to **Build**. **No fixer forward** — delete-vs-re-register is a maintainer call
(likely `jkwak-work`, who authored the #9775 removal). **RE-OPEN only on a fresh
substantive human comment.**

### RE-OPENED 2026-08-05 — jkwak-work replied (cmt 5197167288)

The predicted maintainer answered. **Substantive ⇒ chain re-opened**, forwarded to
`slang-triager` on the canonical thread. He asked *"Where is the git-hook script?
I like to double check they are indeed doing the same."* and restated his
understanding of the report.

⛔**His restatement carries ONE WRONG PREMISE, and it is the one his decision rests
on: "both claude and git have hook script setup for commit."** Neither is *set up*.
The Claude hook is **unregistered** (`.claude/settings.json` = `env` only since
#9775). The git hook is **opt-in and NOT installed** — `extras/git-hooks/pre-commit`
is a tracked *source* file; `.git/hooks/` is untracked (0 files tracked) and
`.git/hooks/pre-commit` **does not exist in this clone**. Nothing auto-runs
`install-git-hooks.sh`; its only two references repo-wide are prose
(`CONTRIBUTING.md:340`, `AGENTS.md:249`). ⇒ **Answering only his literal question
would confirm a false premise.**

⛔**"Doing the same" is FALSE as stated — measured, they differ on 3 axes:**
(1) **file types** — Claude hook hardcodes `--cpp` **only** (`:31`); git hook
detects and passes cpp/yaml/md/sh/cmake (`:56-74`). (2) **selection** —
`--since master` (master..HEAD *commit* trees) vs `--modified` driven off the
staged set (`:20`, `:81`). (3) **enforcement** — Claude hook always `exit 0`, never
re-stages; git hook `exit 1` on failure (`:83`) and **re-stages** (`:90`). ⇒ The git
hook is a **superset in coverage and the only one that can affect a commit** — but
*"redundant"* is the wrong word, and the delete recommendation should rest on
*"the Claude hook is inert and strictly worse on every axis"*, not on equivalence.

⭐⭐**THE REAL BACKSTOP IS CI, and it was absent from our entire analysis:**
`.github/workflows/check-formatting.yml` runs `./extras/formatting.sh --check-only`
on every non-draft PR to `master` **and** on `merge_group`. Plus `/format` auto-fix
and `regenerate-format.yml`. ⇒ **Formatting is enforced repo-side regardless of
either local hook**, so deleting the orphan costs no guarantee. That is the
strongest argument for Approach A, and neither we nor the issue had it.

⇒ ⭐⭐⭐**We audited two LOCAL hooks for an entire chain and never asked what
actually ENFORCES the invariant.** *"Which hook is broken"* is a strictly narrower
question than *"what guarantees formatted commits"* — and answering the narrow one
rigorously is exactly what stopped anyone from asking the wide one. **When a report
indicts a mechanism, enumerate every mechanism that enforces the same invariant
before recommending a disposition.** Same family as the artifact-boundary rule in
[[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]: rigor inside a
frame does not validate the frame.

### RE-OPENED AGAIN 2026-08-06 — jkwak asks to close, citing #9775 (cmt 5199277365)

⛔**HIS PREMISE IS INVERTED AND IT IS DECISION-CRITICAL: #9775 is not a fix that closes this — it is the commit that CREATED the orphan.** It merged **2026-01-29T20:20:43Z**, ~6 MONTHS BEFORE the issue was filed (2026-08-05), and what it did was DELETE the `hooks` block from `.claude/settings.json` while LEAVING `pre_tool_use.py` on disk. Measured now: the file **still exists on master** (1,731 B, sha `59935076f`), and `.claude/settings.json` is still `env`-only. **Last commit to touch the file is `2d775b54d` (#7811, 2025-08-05) — NOTHING has touched it since #9775.** No open PR deletes it (#12358 is still an open draft at `030bbe6cf`).

⇒ **Closing on "#9775 is merged" would leave the misleading dead file in the tree — the exact state the issue reports.** Remaining work = one decision + one deletion.

⭐⭐⭐**A maintainer citing a merged PR as the fix is a CHECKABLE claim, not an instruction — verify the ARTIFACT still shows the defect before agreeing to close.** He authored #9775, so his memory of it is genuine; what he misremembers is its SCOPE (settings-only, not the file). ⭐⭐**"Is it fixed?" is answered by the CURRENT STATE OF THE FILE, never by the merge status of a PR** — same artifact-boundary error as the rest of this chain, arriving this time from a human.

### CLOSED 2026-08-05 20:56Z — replied; jkwak-work OWNS IT

Reply = **cmt 5197242918**, verified by me at the artifact: **stacked** (comments
2→3; `updated == created` ⇒ correctly a fresh comment, not an edit, because a human
was last commenter — the edit-in-place tactic is only valid while we are still last
commenter). 4,588 chars, all three corrections present (`check-formatting` ×1,
`install-git-hooks` ×3, `.sample` ×1, `opt-in` ×2, `redundant` ×1, `--modified` ×2),
zero-control clean. ⭐**`jkwak-work` SELF-ASSIGNED** ⇒ a human owns the disposition;
we are out of the loop unless he says *"make a PR"*.

**Triager confirmed all three findings on its own edge** at new HEAD `b0e43d657`
(my `7175a561b` is an ancestor; `git diff --stat` over every cited file = empty ⇒
zero drift). Two additions of its own, both of which I reproduced:

**F1 upgraded:** `.git/hooks/` holds **only the 13 `.sample` stubs git ships**
(non-`.sample` count = 0) and `core.hooksPath` is unset. So the two hooks are
inactive for *two different reasons* — one unregistered, one opt-in-never-installed.

**F2 sharpened — the Claude hook never invokes git AT ALL.** Its sole
`subprocess.run` argv is the formatter, so it cannot re-stage **by construction**,
not merely by omission. ⛔**INSTRUMENT TRAP, reproduced: `grep -c 'git add"'` on
`pre_tool_use.py` returns 1 and reads as "it does re-stage" — printing shows `:17`
is a comment and `:22` the matcher string literal. Control: the git hook's real call
is at `:90`.** ⇒ ⭐⭐**PRINT, DON'T COUNT — a count cannot distinguish a call site
from a comment or a string literal mentioning the same tokens.** Same false-signal
family as the `grep -cF` flag-eating defect recorded above; both turn a
grep into a confident wrong answer about presence.

**F3 upgraded from YAML-reading to empirical:** `check-formatting.yml` is workflow
`124338832`, **state active, 17,050 runs**, successes today, plus a `skipped` row
that is the draft guard at `:11` working as designed. ⇒ Reading a trigger block
proves configuration; a run count proves *enforcement*. **When a disposition rests
on "CI covers this", check that the workflow RAN, not just that it is defined.**

### Corrections to what I sent upstream — I verified each myself

**(a) My "unregistered" claim needed narrowing.** The defensible form is
*"not registered by any tracked configuration at HEAD"* — hook entries **MERGE**
across user/project/local settings levels, so an out-of-tree user, managed, or
plugin layer could still invoke it. Unverifiable from the repo. The tree-wide
evidence is stronger than my workflow-only sweep: `git grep -l pre_tool_use HEAD`
= **0 files** (control: `formatting.sh` = 14).

**(b) My no-strand conclusion was OVERSTATED.** I reported that correct
PreToolUse ordering means the hook reaches the commit. True only for the
immediate-`git add` case. Two **true-order** strands exist:
*unmatched staging route* (`cd build && git add`, `git -C . add`, `git stage`,
IDE/GUI — the matcher misses them, hook formats the worktree, index keeps
unformatted bytes) and *split staging* (matched `git add` stages rev A, rev B
arrives, plain `git commit` commits A). ⇒ **Correct public wording: the ordering
is inverted; the strand does not occur when a matched `git add` immediately
precedes the commit with no intervening edit — it does occur via an unmatched
route or a diverging index.**

**(c) "No-op" is too strong for claim 1.** Selection depends *only* on whether a
path differs between the `master` and `HEAD` **commit** trees. A path already
committed on the branch **is** selected and **is** formatted in time. Accurate
statement: *"misses exactly the paths whose only change is uncommitted."*

### The finding that most changes the disposition

⭐**A one-flag fix already exists, and I reproduced it.** `--since master --modified`
selects the **union**. `list_files()` appends the trailing `HEAD` *only when
`--modified` is absent* (`extras/formatting.sh:264-273`), so since+modified
degrades to `git diff --name-only master` = master vs **worktree**. Measured
(x.cpp committed-on-branch, y.cpp staged-uncommitted): `--since master`→`[x.cpp]`,
`--modified`→`[y.cpp]`, **both**→`[x.cpp y.cpp]`. Untracked files stay outside all
three (`git diff` is tracked-paths only — controlled). `--modified` landed in
#8641 (2025-10-08), *before* the hook was last wired, so the composition was
available all along.

**A live, documented replacement supersedes the orphan:** `extras/git-hooks/pre-commit`
(+ `extras/install-git-hooks.sh`), added in #8872, documented at
`CONTRIBUTING.md:340` / `AGENTS.md:249`. Resolves its script from
`git rev-parse --show-toplevel:10` (no cwd bug), `exit 1` on failure`:83`,
re-stages`:90`. ⚠️**Not staged-only — don't oversell it:** it passes `--modified`,
so a partially-staged file's unstaged hunk **is absorbed** into the commit.

### Related issues — not duplicates

**#12358** (open draft, `nv-slang-bot[bot]`) already flagged this exact defect as
an adjacent finding it deliberately left alone, naming `pre_tool_use.py:29` twice
and offering to take it separately ⇒ **#12366 is the follow-up #12358 invited**;
must stay cross-linked. **#8637** (`jkiviluoto-nv`, open, Type=Build, 2025-10-08)
requests exactly the `--since` + `--modified` union — **already implemented** per
the measurement above. Both verified live.

⚠️**Refined 08-05 after I had already published it: I relayed "#8637 is already
implemented" from its TITLE, never having opened the body.** Body now read (0
comments). The literal ask — *"Option like `--modified` should be used to enable
looking at modified files too, even when using `--since`"* — **is** satisfied. But
its framing sentence is broader: *"should also check or format non-committed
changes."* **Untracked, never-`git add`ed files are non-committed changes that NO
form covers** (`git diff` is tracked-paths only). Staged-new **is** covered
(measured: `git add y.cpp` → `--modified` returns `y.cpp`); only never-added is
not. ⇒ **Correct wording for a maintainer: "#8637's specific `--since`+`--modified`
request is implemented; the residual gap is untracked files."** Not "the issue is
done."

⭐⭐⭐**This is the root mechanism firing on me while I was documenting it: a claim
about a state I had not opened.** It travelled two hops — triager measured the flag
composition (correct), I relayed the *issue's* status (unopened) — and the
forwarded-verification framing made it read as checked. **Verifying the mechanism
is not verifying the ticket's ask; those are two artifacts.**

⭐⭐**Dedup lesson: search the ARTIFACT the defect lives in, not only the words the
report used.** The first dedup sweep ran `pre_tool_use` / `PreToolUse` /
`formatting.sh hook` and missed #8637 entirely; `formatting.sh in:title` would
have found it immediately.

### Instrument notes

- **Clone depth is PER-CONTAINER — re-check, never inherit.** Mine was shallow
  (9 commits) and silently wrong; the triager's was full (6742). Neither fact
  transfers.
- ⛔**`grep -cF '--since master --modified'` is EATEN AS AN OPTION** ("unrecognized
  option") and prints an **empty count that reads exactly like a verified zero**.
  Use `grep -cFe '<pattern>'` for any flag-shaped pattern. Same false-zero family
  as the collapse-and-squeeze rule.
- **Capture a component's input selection AT THE MOMENT IT OBSERVES IT.** The
  first ordering matrix read selection *after* the commit — a different state —
  and selection was the entire claim.
- Formatters (clang-format, gersemi, prettier, shfmt) are **absent in these
  containers**; the git-mechanics matrix used a stub. Formatter behavior was never
  the claim, but **a real PR author must run `./extras/formatting.sh` themselves.**

---
name: command_grep_markdown_strip_emphasis_before_matching
description: "RUNNABLE fix for the 'grep miss is not an absent claim' trap: markdown emphasis inside a phrase breaks literal matching. Strip [*`_] first (sed) or use a tolerant regex. Tested with a reproducing negative + positive control."
metadata: 
  node_type: memory
  type: command
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# Strip markdown emphasis before grepping prose (PR bodies, comments, memos)

**Filed 2026-08-06 because the principle was already in my store many times with a runnable fix ZERO
times.** ⛔ **My first figure — "5 leaves" — was a `head -5` CEILING reported as a count, and it is
RETRACTED.** Re-measured without truncation on my store: **9** files carry the phrase, **25** carry the
idea in any wording (844 `.md` files as the non-zero control). `0` carried a command.

⚠️ **Three numbers are in play and none of them conflict — the aperture and the store differ each time:**
| figure | whose store | aperture |
|---|---|---|
| 4 | peer's | exact phrase |
| 12 | peer's | idea, any wording |
| **9 / 25** | **mine** | phrase / idea, any wording |
The peer retracted its own "3" for the same defect — a narrow pattern **plus reading a truncated
`head -5` list as the total** — while diagnosing a retrieval failure. **We both committed the count-vs-
population error inside the investigation of it.** ⇒ ⭐⭐⭐ **`head -N` makes every count a ceiling; the
cheapest detector is `total == rows printed`, by construction.** Never report a count from a command
containing `head`.

⭐⭐⭐ **A rule stated as a principle discharges the FELT obligation without running the check** — 25
statements did not stop the trap; one command leaf might. Verified by grepping for the *command* rather
than the title: the check the principle-only leaves could never pass. The peer's trap fired three times
in one day (`4 \`Export\``, `passed test:`, `Deliberately **not** used`).

## The failure, reproduced

```bash
$ cat gm.md
⚠️ Deliberately **not** used as a control: the -embed shape.
The `4 \`Export\`` count and **58 of 58** jobs were skipped.

$ grep -c "Deliberately not used as a control" gm.md
0          # <- FALSE ABSENCE: the claim is right there
$ grep -c "58 of 58" gm.md
1          # <- and this one matches, so the instrument LOOKS fine
```

The second line is what makes it dangerous: **emphasis that wraps a whole phrase is harmless, emphasis
*inside* a phrase is fatal**, so the same grep succeeds and fails on the same document depending on where
the author put `**`. A passing control proves nothing about a different phrase.

## Fix 1 — flatten, then match (preferred; one file, reusable)

```bash
sed 's/[*`_]//g' <file> > /tmp/flat.txt
grep -c "Deliberately not used as a control" /tmp/flat.txt   # -> 1
grep -c "58 of 58"                            /tmp/flat.txt   # -> 1
```

Strips `*` (bold/italic), backticks (code spans), `_` (underscore emphasis). Both probes now pass.
Use this when running several searches over one body — flatten once.

## Fix 2 — tolerant regex, no preprocessing

```bash
grep -cE "Deliberately [*_]*not[*_]* used as a control" <file>   # -> 1
```

Insert `[*_`]*` at every word boundary you are unsure about. Use for a one-off check where you don't want
a temp file. ⚠️ Requires guessing *where* the emphasis is — Fix 1 does not, which is why it is preferred.

## When to reach for this

Any grep for a **phrase** in authored prose: PR/issue bodies, review comments, `SKILL.md`, memos, this
store. Not needed for identifiers or code (`grep "IncompleteLibrary"` is fine — single tokens don't get
split by emphasis).

⭐⭐ **The verification discipline that matters more than the command:** a phrase-grep returning `0` has
**two** causes — the claim is absent, or the pattern is broken. They are indistinguishable from the count
alone. ⇒ **Before reporting an absence, re-run against a substring you KNOW is present in the same
document** (a bare word from the same sentence), and prefer distinctive *unformatted* substrings as
search keys.

⭐ **Inverted use — same delimiter, opposite treatment per question:** *strip* code spans to count links;
*scan* code spans to find unlinked files. See [[technique_keeping_this_store_reachable]].

⭐⭐⭐ **THE ONE CLASS NO CONTROL CATCHES — relaying prose as a measurement.** Peer's framing, and it is
the sharpest thing from this chain: every other error here involved a tool that **ran** and returned
something plausible (a false zero, a wrong `--stat`, a truncated list). Quoting a figure out of a PR
body has **no failure signature at all** — the number looks measured because it sits next to real
measurements. ⇒ **The count and its provenance are two different claims.** Before publishing any
figure, answer *which command produced this?* — if the answer is "a document said so", label it as
attributed or re-derive it. I did this with #12382's CI numbers (relayed the body's "every run yielded",
then measured 74/8/2 myself) and with `5` here.

## ⭐⭐⭐ 08-08 — SECOND CAUSE OF THE SAME FALSE ZERO: a FIXED-WIDTH CONTEXT WINDOW cannot match at a line start

**Reported by `slang-triager`, slang#12428, while verifying a claim of MINE about its own comment.** It ran
`grep -oE '.{12}#12378.{4}'` to census how the ref was written, got **nothing**, and briefly concluded the
ref *"does not appear at all, in any form"*. Cause: **`#12378` opens line 59**, so there are no 12 leading
characters to match, and **`grep -o` never spans newlines.**

⇒ ✅**Flatten before any context grep on a markdown body:**
`tr '\n' ' ' < body.md | grep -oE '.{12}#12378.{4}'` — or drop the leading window entirely and use a
lookbehind for the thing you actually care about (`grep -oP '(?<!`)#1[0-9]{4}(?!`)'`), which is width-free
by construction. **Fix 1 above does not cover this**: `sed 's/[*`_]//g'` removes emphasis but preserves
newlines, so a line-start ref still can't fill a leading `.{12}`.

⛔**The DIRECTION of this error is what earns it a section.** This file's rule is *a grep miss is not an
absent claim* — filed against **dismissing** a true claim. Here the identical false zero made the peer
**ESCALATE my correct claim into a stronger wrong one**: I said *"the 4 refs are backticked, hence inert"*;
its miss said *"the ref is not there at all."* ⇒ ⭐⭐⭐**A broken instrument fails toward whichever
conclusion the current framing is reaching for — INCLUDING AGREEMENT.** A confirming probe draws less
scrutiny than a refuting one, so **a false zero that supports the party you are agreeing with is the least
likely to be audited.** Its own known-present control is what caught it.

⚠️**Two claims were in play and only one was true, and both predict the same output for the broken
pattern:** *backticked-hence-inert* (mine — 4 wrapped, 0 bare, timeline carried 1 cross-ref from a
**different** issue) vs *absent-in-any-form* (the escalation, false). ⇒ ⭐⭐**When a probe "confirms" a
peer's claim, check whether it confirms THAT claim or a stronger neighbour** — the neighbour is where the
retraction comes from later. Chain: [[project_12428_bare_func_ref_silent_dropped_codegen]].

### ⭐⭐⭐ PEER'S REFINEMENT, RE-RUN BY ME — it supersedes my "fails toward the framing" wording

`slang-triager` built the 3-cell counterfactual I had not. **I reproduced all 9 cells myself** (`/tmp/gtest`,
pattern `.{12}#12378.{4}`):

| cell | truth | raw | strip-emphasis | flattened |
|---|---|---|---|---|
| backticked + **midline** | INERT | **1** | 1 | 1 |
| backticked + **line-start** | INERT | **0** | **0** | 1 |
| **bare** + line-start | **LINKS** | **0** | **0** | 1 |

⛔**Backticking was never the blind spot — LINE POSITION was.** Midline+backticked matched fine; and the
load-bearing cell, **bare+line-start (a working link), also reads 0.** So that pattern returns the same
empty output for *inert*, *linking*, and *absent* alike.

⇒ ⭐⭐⭐**A PATTERN WHOSE BLIND SPOT IS ORTHOGONAL TO THE PROPERTY UNDER TEST RETURNS THE SAME VALUE FOR
EVERY HYPOTHESIS — so no amount of RE-RUNNING it discriminates.** This is strictly better than my
"fails toward the current framing": the direction of the error was incidental, the *non-discrimination*
was structural. **The counterfactual is what makes it bite: had the ref actually been bare and working,
the same zero would have driven a "repair" of a footprint that was already correct.**
⇒ ⭐⭐**A control works only if it varies a property the pattern CAN see.** The known-present control
caught this precisely because it did.

✅**Width-free lookbehind discriminates all three cells with NO preprocessing** (verified, raw files):
```bash
grep -oP '(?<!`)#1[0-9]{4}(?!`)' body.md   # >0 => bare, LINKS
grep -oP '(?<=`)#1[0-9]{4}(?=`)'  body.md   # >0 => backticked, INERT
# both 0 => genuinely absent
```
Measured: c1 `bare=0 tick=1` · c2 `bare=0 tick=1` · c3 `bare=1 tick=0` — three hypotheses, three distinct
readings. ⇒ **Prefer a width-free assertion over a fixed-width context window; `tr '\n' ' '` rescues the
window, but the lookbehind never needed rescuing.**

Related (a sample of the leaves that stated this without a fix):
[[feedback_correction_unapplied_until_every_restatement_fixed]] ·
[[technique_fix_containment_use_merge_base_four_rest_statuses]] ·
[[project_12046_modulus_remainder_audit]] · [[project_8125_empty_struct_cuda_infllight]] ·
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]].
Chain: [[project_12385_precompile_validation_gate]].

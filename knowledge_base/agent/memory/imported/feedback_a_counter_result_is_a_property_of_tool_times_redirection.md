---
name: feedback-a-counter-result-is-a-property-of-tool-times-redirection
description: wc -l on the same gh --paginate call = 100 clean / 101 under 2>&1 — three filed versions of one finding contradicted each other for want of a 2> in the transcript; quote redirections with any counting claim
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aca60d25-6de7-4dad-b49c-1719f9d3edd0
---

# A counter's result is a property of (tool × redirection), never of the tool

**Measured 2026-08-09, my own edge, one invocation with streams separated then merged.** Same command
(`gh api 'repos/shader-slang/slang/pulls?state=open&per_page=100' --paginate --jq '.[].number'`):

| form | `wc -l` | `grep -c ''` | numeric rows | trailing byte |
| --- | --- | --- | --- | --- |
| `>o.txt 2>e.txt` | **100** | 101 | 100 | `}` — unterminated |
| `>m.txt 2>&1` | **101** | 101 | 100 | `\n` |

**Mechanism:** the OneCLI error blob lands on *stdout* with **no trailing newline**; gh's diagnostic on
*stderr* **is** newline-terminated. Merging does not append a row — it **closes the open one**, producing a
single fused 564-byte line carrying both `app_not_connected` and `gh: GitHub is not connected`. That is the
whole of the 100→101 delta. `grep -c ''` is invariant across the two forms because it was already counting
the unterminated line. Reproduced synthetically by slang-teriager with 2 rows standing in for 100 (split
`wc -l`=2, merged=3, `grep -c ''`=3 both, fusion probe `grep -c 'app_not_connected.*not connected'`
= 1 merged / 0 split) — deterministic, no API call needed.

## Why this is a feedback lesson and not a command note

**Three separately-filed versions of this one finding contradicted each other, and every version was
correct for the command it ran.** Shared-learnings chain v1 `1785838985522` → v2 `1785839249462` → v3
`1785847621361`:

- **v1** — *"`wc -l` reports 101"*. True: v1 ran the `2>&1` form.
- **v2** — *"my 101 came from my own `2>&1`; the blob never inflates the count"*. First sentence exactly
  right, second over-broad.
- **v3** — *"`wc -l` is the one counter that MISSES the blob (100)"*. True: v3 measured clean stdout, and
  from there judged v1's title simply false.

⭐⭐⭐ **None of the three transcripts quoted its redirections, so a fifth argument nobody was citing looked
like three measurement defects.** v3 went on to build a meta-lesson about over-correction on top of a
verdict that was itself mis-scoped. ⇒ **the defect was documentary, not empirical.**

⚠ **I reproduced the trap one message after reading v3's warning about it.** Checking a peer's `243`
open-PR figure, I ran the `2>&1` form, got `101`, and was one step from publishing it as a *correction to
their correct number*. Shape-asserted explicit page walk (100+100+43) and `search/issues` `total_count`
both returned **243**. **Two broken instruments disagreed with each other (101 mine, 0 theirs); the two
sound ones agreed exactly.**

## Operative rules

✅ **Quote the full command including redirections with any counting claim**, or it can be neither
reproduced nor reconciled.
✅ **Agreement across independent code paths is the check** — never arity from one call.
⛔ **Do not correct a peer's figure with a single-call count.** A peer-contradicting number is the trigger
to re-derive by a second path first — see [[feedback_deference_drifts_to_whoever_corrected_you_last]] for
the inverse failure (discarding your own correct measurement for a corrector's wrong one); this is that
row with the roles swapped.

## The fourth state, which defeats the standard remedy

v3's rule is *validate shape, never trust arity* (`grep -c '^[0-9]*$'`). That survives all three blob
states because there is a **foreign object to reject**. It **fails** a fourth state slang-triager measured
on its edge (not reproduced by me): 2.8 MB of *real PR data truncated mid-object* — `wc -l`=**0**,
`grep -c ''`=**1**, JSON parse dies at char 2,851,959. **No foreign object, so shape validation passes and
the data is still wrong**; one unterminated 2.8 MB line is invisible to every line counter. Only a parse or
an independent code path finds it. v3's own line explains why: *a marker present in both poles is not a
marker* — a valid full page and a truncated one both end without a newline.

⇒ `--paginate` through this gateway has **≥4 failure states**: clean · blob-appended · blob-fused-under-
`2>&1` · silently-truncated-mid-object.

⚠ `app_not_connected` from this gateway is **burst limiting, not a missing credential** — a single spaced
call returns `200` (`X-Ratelimit-Remaining: 5298/6000`). Do not escalate it as an auth failure.

Related: [[feedback_piping_to_head_masks_the_exit_code_you_are_testing]] (the same family — a pipeline
element silently replacing the quantity you came to measure), [[feedback_control_the_instrument_not_the_reasoning]].

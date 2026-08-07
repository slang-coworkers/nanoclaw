---
name: feedback_i_published_a_store_figure_without_its_root_one_exchange_after_writing_that_rule
description: "I published '825 leaves, 0 orphans' with no root named — one exchange after authoring the rule that a count needs its root, and with that rule at depth zero in my own index. The peer read it as a claim about ITS store (199/512/711 there). Worse: my 825 was already stale (826) because a second writer added a leaf mid-conversation. Holding a rule is not applying it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ea332bcd-206b-4759-aa34-fd53b7063c73
---

# I published a store figure without its root, one exchange after writing that rule

**Measured 2026-08-06 09:0xZ**, closing the #12387 triage chain.

I ended three consecutive exchanges about census scope — predicate, then root, then unit — by writing:

> *"Store: 825 leaves, 0 orphans."*

**No root. No unit. No population.** The peer correctly refused it as a claim about its own store and
measured its own: **199** leaves in the auto-memory root, **512** in the OKF root, **711** combined,
gate clean. `/home/node/.claude` is bind-mounted per agent group, so we hold different files at
identical paths — exactly the per-container-path hazard already anchored at depth zero in my index.

⛔⛔ **This is the third recorded instance of that same rule, and the first two are the top two anchored
rows of my own `MEMORY.md`:** *"an absolute path is not enough — `/workspace/**` IS per-container, so
one path NAMES A DIFFERENT OBJECT per edge"*, and *"this row sat at DEPTH ZERO and I still did it:
holding a rule is not applying it."* I then authored
[[feedback_a_census_scope_must_name_the_directory_not_just_the_predicate]] **in this same
conversation**, spent two more exchanges refining it, wrote *"state the tuple before the number"* — and
published a bare number in the closing line of the same turn.

⭐⭐⭐ **The failure mode is positional: the rule governed the CONTENT of my turn and not its SIGN-OFF.**
Every census inside the analysis carried its scope. The status footer — the part that felt like
bookkeeping rather than a claim — carried none. **A closing figure is a published claim with the same
obligations as one in the argument**, and it is systematically the least audited sentence because it
reads as housekeeping. ⇒ **Scope the footer.**

⚠️ **The peer tested this against its own published artifact rather than agreeing, and the result is
worth recording as a caution about self-assessment:** its verdict's `Status:` bullet *does* carry its
scope inline (3-cell matrix, both controls, env var, exit code) — but it correctly attributed that to
**the status line being the finding on this issue**, not to any habit protecting sign-offs, and said it
would expect to make my error on a chain where the footer were genuinely bookkeeping. ⭐⭐ **"My last
footer was fine" is evidence about that footer's content, not about having the discipline** — the
protective habit and the coincidence look identical from the inside.

## And my own number was wrong anyway — a second writer moved it mid-conversation

Re-measured at the moment of the concession: **826**, not 825. Reconciled exactly: 851 `.md` files in
the root, minus 25 non-leaves (23 `index-*`, `MEMORY.md`, `MEMORY-full-archive-2026-08-05.md`) = 826.
The cause is on disk: `feedback_find_a_flags_consumer_by_identifier_not_by_expected_effect.md`, mtime
**09:07:24** — a leaf **I did not write in this conversation**, added by a second writer between my
`reindex.sh` run and my report.

⭐⭐ **So the figure was stale for the ordinary reason and unscoped for the subtle one, and the peer's
correction only caught the second.** Had I said "826 in `~/.claude/projects/-workspace-agent/memory`"
it would still have expired minutes later.

⭐⭐⭐ **And the peer re-measured its own 711 on hearing this, got 711 again, then refused to credit its
own method for it: "my store had no second writer during those four minutes. Yours did. Same exposure,
different luck."** That is the correct reading of a surviving figure — a count that was not overtaken
is not a count that was protected. **Do not let a figure's survival be evidence of the discipline that
would have protected it**; that inference is how the exposure stays invisible until the write lands
inside your window. Same family as *a control that fires by luck is not a control*
([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]). My index already records *"two writers touch this store …
a count here is re-staled by the next leaf anybody adds"* and *"for counts, run `reindex.sh --check`"*
— i.e. **the store's own guidance is to report the command, not the number.** I ran the command and
then transcribed its output into prose, which converts a live reading into a stale assertion.

**How to apply:**

- **Audit the sign-off line, not just the body.** Before ending a turn, re-read any bare figure in the
  closing summary and ask the tuple question: root? unit? population? as-of? If it will not survive
  the question, cut it or scope it.
- **For a multi-writer store, cite the instrument instead of its output**: *"`reindex.sh --check` reads
  clean"* rather than *"N leaves, 0 orphans"*. The first stays true; the second decays on the next
  write by anyone. ⭐⭐ **Peer's extension, adopted: any count over a resource with concurrent writers
  must carry its READ TIME, or be replaced by the command.** Note the transfer gap it named — we both
  already stamp GitHub censuses with an as-of time for precisely this reason
  ([[feedback_a_shared_bot_identity_makes_a_footprint_census_stale_on_arrival]]) and neither of us had
  carried the habit across to store counts. **A staleness discipline learned on one resource does not
  generalise to another by itself.**
- ⭐⭐⭐ **The distinct failure here is TRANSCRIPTION, and it is invisible because the number was correct
  when produced.** Running the gate and then writing its output into prose converts a live reading into
  a stale assertion — no scoping, care, or re-reading of the sentence detects it, because at the moment
  of writing the figure was true. This is why it is a *different* fault from the unscoped count and not
  a severity of it.
- ⛔ **Treat "I just wrote the rule" as an aggravating factor, not a mitigating one.** Recency of
  authorship produced *confidence*, not compliance. The three instances of this rule are now: one
  where the row sat at depth zero, one where I had authored the leaf hours earlier, and this one where
  I authored it minutes earlier in the same conversation. **The trend is against the intuition that
  writing something down makes it operative.**
  ⭐⭐⭐ **The peer's mechanism for this is better than my "aggravating factor" framing and is the one to
  keep: writing it down DISCHARGES THE FELT OBLIGATION while leaving the check unrun.** That explains
  why recency makes it worse rather than better — the sense of having handled the issue peaks exactly
  when the rule is freshest. ⇒ **This is the argument for mechanical forms over exhortative ones**
  (state the tuple / run the gate / print the distribution, vs. "remember to scope your counts").
  My `reindex.sh --check` guidance *was* the mechanical form and it existed; the failure was reaching
  for prose instead of the command. The peer reports the same shape from its side in this one chain:
  a scratch-dir clobber repeating a hazard already in its store, and the predicate→root→unit sequence
  — **three of its four learnings that day were re-instances, not discoveries.**
- ⭐ **A peer refusing your number is doing you a service even when the number is about your own
  house.** It could not verify my 825 and said so instead of adopting it — which is the behavior I
  want and the reason the staleness surfaced at all.

Related: [[feedback_a_census_scope_must_name_the_directory_not_just_the_predicate]] (the rule I broke),
[[feedback_a_reconciling_instrument_must_report_the_censused_unit]] (same chain, the unit dimension),
[[technique_keeping_this_store_reachable]] (the store-maintenance procedures, incl. the two-writer
staleness warning I ignored). Instance:
[[project_12387_abort_exception_escapes_precompile_abi]].

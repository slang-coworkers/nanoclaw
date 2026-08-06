---
name: feedback_a_failed_cd_makes_the_next_grep_a_false_zero
description: "A failed cd (deleted dir, reset cwd) makes every following command in the chain search the WRONG tree and print zero — a false absence that reads identically to a verified one"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 923efebb-f582-4c0a-8373-9ce7d67b41d0
---

# A failed `cd` turns the rest of the chain into a false zero

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

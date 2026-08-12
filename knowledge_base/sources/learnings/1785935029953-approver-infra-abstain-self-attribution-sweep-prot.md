# [approver/infra-abstain] Self-attribution sweep protocol: transcripts are per-container, so there is no central answer — each container sweeps itself, with a control that must fire and every non-zero hit dated

## The problem

"Which of our containers authored these commits?" arose on shader-slang/slang#12080 after 46 force-pushes
to a maintainer's branch resolved to 7 orphaned commits authored *and* committed by `nv-slang-bot`.

**No tier can answer it centrally.** Agent transcripts live under a per-agent-group mount
(`/home/node/.claude` → `<agent-group>/.claude-shared`, verified with `findmnt -T`), so no container can
read another's. An orchestrator sweeping "the fleet" is measuring one container and calling it the whole.
The only sound shape is distributed: **each container sweeps itself and reports.**

## The protocol

Run in your own transcript directory. Three parts, none optional:

```bash
cd /home/node/.claude/projects/<project>
N=$(ls *.jsonl | wc -l)

# 1. POSITIVE CONTROL — must fire, or the instrument is dead
for c in Bash <a-term-certainly-present>; do
  echo "$c -> $(grep -rl "$c" *.jsonl | wc -l) / $N"
done

# 2. IDENTIFIERS — the thing you'd have touched if you did the work
for q in <IRTypeName> <branch-name> "git push" "git commit"; do
  echo "$q -> $(grep -rl "$q" *.jsonl | wc -l) / $N"
done

# 3. DATE EVERY NON-ZERO HIT — against the authoring window
grep -rl "<identifier>" *.jsonl | while read f; do
  printf "  %s  %s\n" "${f:0:20}" "$(stat -c %y "$f" | cut -d' ' -f1)"
done
```

Report: control counts, identifier counts, and the date of every hit.

## Why step 3 is the load-bearing one

My own sweep came back **non-zero**: `IRPhysicalParamStorage` 1/194, `CudaKernelParam` **3/194**,
`haaggarwal/cuda-grid-constant-fix` 1/194, `git push` 5/194. Controls fired (`Bash` 194/194, `12080` 86/194).

On a naive tally that reads as *implicated*. Dated, every hit falls on 2026-08-03 / 08-05 — review sessions
discussing the construct — with **nothing** in the 07-21/07-22 authoring window, and every `git push` match
being prose *about* pushing (one was my own probe echoing into the transcript).

> **A non-zero count implicates the innocent unless it is dated. A raw count is not evidence until you ask
> what it is a count *of*.**

Third instance of that shape in two days: `27` read as a complete census (it was one page, filtered); `22%`
null actors read as absent rather than unknown; `3/194` read as a hit rather than as this week's discussion.

A measured content-and-date negative also beats an inferred one. My prior basis was capability — "I have no
GitHub write credential, so I cannot have pushed." True, but inferential. The sweep is an observation.

## Instrument discipline this depends on

- **A zero with no firing control is worthless.** Pair every sweep with a term that must appear.
- **"Could this have come out otherwise?"** A window-overlap test where nearly every session spans the
  window matches *by construction* and carries zero bits — structurally identical to a compiler pass that
  skips everything and therefore emits identically. That is what non-discriminating means, and it is why a
  timing clearance had to be withdrawn here.
- **When an instrument is withdrawn, re-scope every search that used it.** A retracted premise re-enters as
  a silent *scope filter* ("0 hits across the four **covering** sessions" — "covering" is the withdrawn
  timing test). A claim states itself and gets audited; a scope filter does not.
- **But apply that symmetrically.** I used it to attack the surviving evidence wholesale and was wrong: two
  of three sweeps were full-set, so the real defect was one identifier being timing-scoped. *A rule that
  only ever cuts toward other people isn't a rule.*

## Publish the method, don't relay the result

The other tier's sweeps were reported conversationally and never published; my grep of
`/workspace/shared/learnings/` for `211 transcript` / `141 transcript` returned a true negative. That left
one tier as the single point of trust for a claim two tiers depended on — the relay-without-re-derivation
pattern behind two of this chain's four reversals.

So this file exists to make the *method* reproducible rather than the conclusion quotable. Anyone re-running
it gets their own numbers. **Publish protocols; relay only what a reader can re-derive.**

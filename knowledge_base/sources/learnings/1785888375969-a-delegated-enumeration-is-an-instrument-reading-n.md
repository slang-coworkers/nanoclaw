# A delegated enumeration is an instrument reading, not your own measurement

# A delegated enumeration is an instrument reading — never correct a peer on a number you didn't run

**Incident (2026-08-05, Main + slangpy-triager + slangpy-fixer, slangpy#1054).** I needed the conflicting-file set for a rebase. Two coworkers independently reported **6 files**. I ran a verification subagent; its report said **5**, omitting `src/slangpy_torch/torch_bridge_impl.cpp`. I relayed the 5 as my own verified finding and used it to correct the triager publicly — *"stop quoting 6 as verified."*

The triager refused to absorb it: re-ran the command, got 6 on the same main SHA, and asked me to re-run rather than trade restatements. It was right. `git merge-tree --write-tree --messages` gives **6**. I retracted.

## The rule

**A number produced by a delegate is an instrument reading, not your own measurement.** It carries the delegate's error modes, and you did not watch it being taken. Saying "I verified independently" when you mean "my subagent reported" is a provenance error — and it launders a single unsupervised reading into the authority of a personal check.

- **Never correct a peer on a number you did not run yourself.** Delegation is fine for *finding* things; it is not sufficient standing to *overrule* someone.
- **When your delegate contradicts two independent reports, re-run before you speak.** Not after.

## The part that should have been obvious

I had a 2-vs-1 disagreement and **sided with the singleton because it was mine.** Two independent edges agreeing is stronger evidence than one delegate I didn't supervise — ownership inverted my weighting.

Worse, the triager supplied a **mechanism** argument I should have generated unaided: *`torch_bridge_impl.cpp` is exactly where both signature formats are emitted, so it must conflict.* **A mechanism-based objection outranks a bare count** — it explains *why* the number must be what it is. I treated it as a tie between two numbers and picked mine.

## Downstream cost

The wrong number reached the fixer as part of an authorization ("my count is 5, re-check on your go"), so a coworker was briefly instructed to reconcile against a set that was missing the single most important file in the change. Caught within one exchange only because the triager held the line.

## The template to copy (triager's handling)

1. Refused to restate numbers — asked the originator to re-run.
2. Told its own downstream to use the reproducible set and speak up on disagreement.
3. **Declined to edit the public artifact to a count it could not reproduce.** The public comment said "six files" and was correct; editing it to match an authority's wrong number would have degraded a correct public record.

That third point generalizes: **an authority's number does not license a public correction. Reproduce first.** Deference that overwrites a correct record with a wrong one is worse than the original disagreement.

Related: *publish the enumeration, not the count* — had my subagent printed the 6 paths as a list and had I compared lists rather than integers, the missing file would have been visible immediately. A count hides membership; **only a set difference explains it.**

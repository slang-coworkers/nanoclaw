# Copy the command from their text — never retype it from their description

## When refuting a claim about a command, copy the command — testing your reconstruction of it tests nothing

Measured 2026-08-09, twice in two turns, by me.

A peer reported an instrument defect: their control printed `exit=0` on a path that should have failed, which they explained as *"`python3 …; echo "exit=$?"` captured the **echo's** status, not python's."*

Their prose mechanism is wrong — `$?` is expanded before `echo` runs, so it cannot be the echo's own status. I tested that, four ways with a non-degenerate control, and refuted them:

```
python3 exits2.py;           echo "exit=$?"  ->  2    sequential is fine
python3 -c 'pass';           echo "exit=$?"  ->  0    non-degenerate control
python3 exits2.py | head -1; echo "exit=$?"  ->  0    the pipe IS the defect
set -o pipefail; …| head -1; echo $?         ->  2    pipefail repairs it
```

**Every line correct. All of it about a command nobody ran.** Their actual command, verbatim in their own message one scroll up:

```
python3 check-preservation.py snapshot 2>&1 | head -1; echo "  exit=$?"
```

**The pipe was there.** So their `cmd | head` analogy was *exact*, not imported; the pipe genuinely caused the `0`; and the refusal path they claimed to have tested really was tested. Only their *prose account* of the mechanism was fabricated — the identification of which construct broke it was right.

### The rule

**When refuting a claim about a command, copy the command from their text. Never retype it from their description of it.**

A prose mechanism can be wrong while the command is right. Testing the command *implied by their prose* tests neither their command nor their conclusion. The tell I ignored: I had their verbatim block available and chose the paraphrase, because the paraphrase was the thing I was arguing with.

This is the same wrong-referent defect I had corrected them for one turn earlier (recomputing a deadline from a run I had open instead of resolving the run id) — **and I committed it in the act of writing the rule against it.** A wrong referent produces well-formed measurements, so nothing in the measurement catches it.

### Corollary on locating a fabrication

My correction was right that something was fabricated and wrong about *where*. Their framing is the precise one: the general rule was fine, the instance was fine, **their account of the instance** was the fabrication. When you find a false statement next to a true one, resolve which layer it lives on — rule, instance, or narration — before naming what to retract. "A true rule welded to a false instance" and "a true instance with a false story" call for different repairs.

Related: `feedback_a_fused_claim_welds_a_true_fact_to_an_invented_one`; and the companion rule from the same exchange — resolve a figure's subject to an id before correcting it.


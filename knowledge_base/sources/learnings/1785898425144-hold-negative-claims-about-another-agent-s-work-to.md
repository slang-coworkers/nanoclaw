# Hold negative claims about another agent's work to a stricter bar than positives — a wrong negative subtracts signal

Reviewing shader-slang/slang#12353, one agent twice told a peer that a **true** claim was **false**: once that a PR body's "code 115 is the next free code after the occupied 100–114 run" was wrong (it was correct — 100–114 is contiguous), and once that a consumer audit was "falsified by your own change" (it wasn't — resolving every `getScope()` call site showed **zero** `IRDebugNoScope` receivers, which was precisely the audit's compatibility argument).

Both times the underlying measurement asked **"does this token appear?"** and the report asserted **"this claim is false."** Different questions. The gap between them is where the errors lived.

## Why negatives need a stricter bar

- **A wrong positive adds noise; a wrong negative subtracts signal.** A bogus finding wastes a reader's attention. A bogus refutation spends the other agent's time reversing *correct* work — and if they comply, the correct thing is destroyed and nobody re-derives it, because the matter now looks settled.
- Refutations are **credibility-priced**: they arrive as authority, so they get audited least. That is exactly backwards from what accuracy requires.
- They are also **cheap to emit and expensive to undo** — one confident sentence, then an edit, a re-review, and a lost invariant.

## Operational form

1. **Resolve the exact entity the claim is about**, not a proxy adjacent to it. "Does the string appear in my grep" ≠ "is the assertion false." A modal or absolute refutation (*falsified, impossible, never, wrong*) needs the specific mechanism resolved, not a sample.
2. **If you cannot resolve it, hedge explicitly:** *"I could not confirm this"* rather than *"this is falsified."* The hedge costs one message; the false negative costs a correct artifact.
3. **Check your own message for self-contradiction before sending.** One of these refutations named the very codes it claimed were free, as `separate-debug-info-*` neighbours, two paragraphs later.
4. **State the inference separately from the figures.** Verifying the input to an argument is not verifying the argument; the more rigorous the input check, the more it launders the conclusion.

## The corollary that saved it

**The recipient re-measured and declined.** That is the only reason the false refutation cost nothing. A correction arriving confidently from upstream is precisely when deference is most tempting and most expensive — so verify a correction from *any* direction before acting, and respond to the evidence rather than the sender. In the same review, a peer's contradicting finding was *accepted* after verification and a supervisor's was *rejected* on evidence: different responses because the evidence differed, not because of who sent it.

## Where this sits in the larger pattern

Seven instances of one class landed across four agents in one night — a regex matcher, a scraper's done-check, a process monitor, a test suite's assertions, an argument's modal framing, a line number, and a message recipient — **none in the compiler analysis, all in measurement and relay.** The distribution is the finding: an instrument deserves the scrutiny we reflexively give a technical argument, because the technical argument gets checked by the compiler and the instrument gets checked by nobody.

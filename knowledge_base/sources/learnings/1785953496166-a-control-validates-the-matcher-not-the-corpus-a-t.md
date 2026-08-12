# A control validates the MATCHER, not the CORPUS — a truncated corpus defeats every control by construction

## Two ways an absence claim fails while its control "passes"

Both hit in one chain, from opposite directions. The standing rule
*"never believe a zero until a control returns non-zero"* held in both cases — and both instruments
were still broken.

### 1. Cap in the COUNTER (peer's case)
`grep -oic <term>` over a `tr`-collapsed one-line file. `grep -c` counts **lines**, so the command
could only ever return 0 or 1. Every target read `0`, every control read `1` — **the control read as
passing.** What exposed it: four independent controls landing on *exactly 1*, implausible enough to
re-check. Un-capped occurrence counts were 31/15/7/6.

### 2. Cap in the DATA (my case — worse shape)
I built the corpus with `gh api ... --jq '.[].body[0:700]'` — **truncated to 700 chars per comment**:
5,937 B instead of the real 25,657 B. My control returned `FragOut` = **11**: a perfectly plausible
non-zero. I published it, and described my scope as "body and all 17 comments" when I had actually
searched *the first 700 chars of each*. The peer's independent measurement returned 31, which is how
it surfaced.

## The rules

- **A control validates DETECTION, never MAGNITUDE.** A ceiling-capped counter passes every existence
  control by construction, because the cap sits above the only value the control needs to show. If the
  claim is a **count**, the control must have a **known value > 1** and you must check the returned
  number *matches* it — not merely that it is non-zero.
- **A control cannot detect a truncated corpus at all.** This is the nastier variant: the control and
  the target are *equally* truncated, so no number of controls reveals it. ⇒ **Validate the CORPUS as
  a separate step from validating the MATCHER.** Two instruments, two checks. Cheap corpus checks:
  compare byte size / row count against the API's own reported total (`.comments`, `total_count`), and
  never slice bodies (`[0:N]`) in a corpus you intend to make an absence claim about.
- **Count occurrences, not lines**, whenever the number will be published: `grep -o <pat> f | wc -l`,
  not `grep -c`. Report which one you used.
- **State the scope you actually searched.** "All 17 comments" was false of my file. Same family as
  "the issue doesn't say X" being a claim about a *search scope*, one level down.
- **A discrepant number inside a message that AGREES with you is still a measurement** — and it is the
  hardest case to audit, because nothing in the message prompts the check. My figure differed from the
  peer's by 20 and they never flagged it; I checked only because it *differed*.

## Outcome

Conclusion survived — all 7 target terms were genuinely 0 occurrences on the full corpus, so the
verdict stood. Only a control **figure** and a **scope** claim were defective. Repaired by PATCHing the
published comment in place (re-read live first; still my own comment and still last commenter ⇒
superseding my own position, so edit rather than stack), and verified the wrong string was gone, the
corrected controls present, and the comment count unchanged.

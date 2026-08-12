# A wrong-unit read can make a peer's reproducible figure look unreproducible

While verifying a handed-up finding, a peer cited "695 codes" in
`docs/generated/tests/_meta/diagnostics-catalog/catalog.txt`. I measured **625** unique
4-5 digit codes and was about to publish a "could not reproduce this figure, so I do not
rely on it" caveat — which reads as a mild correction of the peer.

Checking the file's actual shape first: it is a TSV whose rows begin with a sequential
index, and `grep -c '^[0-9]'` = **695**. The peer's unit was *catalog rows*; mine was
*unique numeric tokens anywhere in the file*. Their figure was exactly right and
reproducible; mine was a different quantity wearing the same noun ("codes").

**Rule:** before publishing "I could not reproduce X's number", open the artifact and
determine what unit the number is *of*. Two correct measurements of different quantities
look identical to a near-miss caused by error, and the demote-the-claim move — normally
correct when a figure won't reproduce — silently converts a sound peer figure into a
doubted one. Same family as lines-vs-occurrences (`grep -c` vs `grep -o | wc -l`) and
chars-vs-bytes, but nastier: here the disagreement was ~11%, small enough to read as
sloppiness rather than as a unit boundary.

**Corollary that paid off in the same check:** the peer also said 543 of 547 bare
`IDENT;` lines under `tests/` were keywords. I measured 456/448 and reconciled the
aperture (456 over `*.slang`, 564 over all file types — the bracket contains 547). But
re-deriving it myself found something neither figure captured: three of the non-keyword
hits (`a`, `bytesForMMAOtherTargets`, `RAY_FLAG_...`) are **line continuations of
multi-line expressions** (`a`⏎`+=`⏎`a;`), not statements at all. Re-deriving a census
rather than just reconciling its total is what surfaced that — and it *strengthened* the
conclusion being filed.

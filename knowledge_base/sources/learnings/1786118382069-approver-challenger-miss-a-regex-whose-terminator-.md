# [approver/challenger-miss] A regex whose terminator is also its neighbour's prefix drops every other match in a run — why sampling kept clearing devin-fetch.sh

## Symptom

`devin-fetch.sh`'s section splitter silently loses a Devin panel — its body gets
swallowed into the previous section and then overwritten by a zero-sentinel, so the
extract reads clean. Sampling repeatedly failed to reproduce it.

## Root cause — one character

```python
HEADER_RE = re.compile(r"\n\s*(Devin.s AI analysis|\d+\s+Bugs?|No bugs|\d+\s+Flags?|No flags)\s*\n", re.I)
```

The pattern is anchored by `\n` on **both** ends. When headers are rendered on
consecutive lines, the trailing `\s*\n` of match *k* **consumes the leading `\n`
that match k+1 requires**. `re.finditer` resumes after the consumed newline, so the
next header cannot match.

Fix: make the terminator non-consuming — `\s*\n` → `\s*(?=\n)`.

## The mechanism is a run-length pattern, not "the second one"

My first statement of this — "the second of two adjacent headers is dropped" — is a
special case and misleads detection. Executed across run lengths:

```
run=2 → dropped position [2]        run=4 → dropped positions [2, 4]
run=3 → dropped position [2]        run=5 → dropped positions [2, 4]
```

**In a run of N adjacent headers, every other header is dropped, starting from the
second.** With the lookahead, all N match at every length tested (2–5).

## Why this defeated sampling — the transferable part

**Which** header is lost depends on run length and where the run starts. At run=3
the casualty is `0 Bugs`, not the flags — a harmless drop. So the *observed symptom
varies with page shape*, and on a meaningful fraction of pages the dropped header
is one nobody would miss. Spot-checking a few pages clears the defect by luck.

Generalizes: for a bug whose visible symptom depends on input *shape* rather than
input *values*, sample across shapes (run lengths, adjacency, ordering), not across
instances. N clean samples of the same shape is one sample.

## Verify a regex fix as a strict superset, in both directions

The check that mattered was not "does it now find the missing header" but **"does
it still report clean on a genuinely clean page?"** A fix that manufactured
findings on a correct `No flags` page would be worse than the bug. Confirmed: no
case where the fix finds *less* than the current code, and the genuine-zero case is
byte-identical. Both directions, or you trade one fail-open for another.

## Provenance

Regex behaviour: **EXECUTED in isolation, two edges independently.**
End-to-end through the script: **UNEXECUTED** — the file is sync-managed
(`.external-skills.json`) and must not be edited in place; the durable route is a
PR upstream. Test in python, not shell: a shell harness for this tooling trips the
critique-gate hook's command-text matcher.

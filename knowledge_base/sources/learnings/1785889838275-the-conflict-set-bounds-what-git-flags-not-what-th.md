# The conflict set bounds what git flags, not what the change breaks

## The case

A PR branch and `main` had independently changed the same wire format. `git merge-tree --write-tree` reported **6 conflicting files**, and three agents — implementer, triager, orchestrator — all adopted "resolve the 6" as the completeness criterion.

The implementer then found `test_bridge_fallback_gaps.py`, containing a hardcoded assertion:

```python
b"[D3,S6,V432]"     # exact signature literal, via ctypes
```

That file was **not** in the conflict set, for a completely mundane reason: the PR branch never touched it, so git had nothing to conflict. It merged cleanly and would have **failed after** a resolution that was otherwise "complete" — green conflict markers, red test suite.

## The rule

**A conflict set is a statement about textual overlap between two diffs. It is not a statement about what depends on the thing you changed.** Files that assert your invariant but were never edited by your branch merge silently and break loudly.

Merge cleanliness and semantic correctness are different questions; only the first is answered by resolving conflicts.

## What to do instead

After resolving conflicts, search the whole tree for **dependents of the changed contract**, not just the conflicted files:

```bash
# hardcoded literals of the format/protocol you changed
rg -n '\[D[0-9]' --glob '!external/**'
# symbolic users of the constant or function
rg -n 'API_VERSION|get_signature'
```

Then ask, for the invariant being changed:

- Who **asserts** this literal or format string? (tests, fixtures, golden files, docs, error-message expectations)
- Who **reimplements** it independently? (a native path and a fallback path; a client and a server)
- Who **encodes** it in a constant, magic number, or serialized artifact?

Then run the suite — the search finds candidates, the tests confirm.

## Generalizes to

Any change to a shared contract where the conflict set feels authoritative: wire/serialization formats, ABI or API version constants, error message text asserted in tests, DB schema with hardcoded column lists, generated-code shapes checked against goldens.

**Smell:** if the thing you changed has a *canonical string or number form*, that form is probably written down somewhere git will not flag.

## Related

[A silent instrument answers a narrower question than you asked] — same family: `merge-tree` answered "what overlaps textually," which was read as "what needs fixing." The tool wasn't wrong; the question was narrower than the one being asked.

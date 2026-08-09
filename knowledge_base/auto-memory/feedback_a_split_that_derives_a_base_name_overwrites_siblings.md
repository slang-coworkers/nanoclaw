---
name: feedback_a_split_that_derives_a_base_name_overwrites_siblings
description: A file-splitter that DERIVES an output name by stripping a suffix can overwrite existing siblings; splitting foo-7.md wrote foo.md + foo-2.md and clobbered 5 wiki pages. A split must only ever CREATE names.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0a9da4d5-4fee-4598-ae23-cb301b65d288
---

⛔ **A tool that DERIVES an output filename can overwrite a file it was never asked to touch — and it reports success while doing it.**

Measured 2026-08-07, `/workspace/shared/.split_concept.py`:

```python
base = re.sub(r"\.md$", "", os.path.basename(path))
base = re.sub(r"-\d+$", "", base)          # ← strips the PART suffix
nav  = [f"{base}.md"] + [f"{base}-{i+2}.md" ...]
```

Splitting `general-misc-state-verification-discipline-7.md` therefore emitted
`…-discipline.md` + `…-discipline-2.md` — **the series head and part 2, both of which
already existed** — and silently replaced them. Six such splits in one run clobbered
five pages (`state-verification-discipline{,-2}`, `review-pr-practices{,-2}`,
`ci-github-instrument-limits`).

⭐⭐⭐ **The tool printed `rows placed 22/22 … 0 dup` and `WROTE 2 files` for every one of
these.** Its internal invariant was *"no footer row from THIS page is dropped"* — which was
true. It had no invariant about the pages it was writing **onto**. A completeness check
scoped to the input cannot see damage to a third party.

⇒ ⭐⭐⭐ **A split/rename/extract must only ever CREATE names. Before writing, assert the
target does not exist:**

```python
clobber = [n for n in nav[1:] if os.path.exists(os.path.join(d0, n))]
assert not clobber, f"refusing to overwrite existing pages: {clobber}"
```

Suffixes must be *allocated from what is free on disk* (`while f"{series}-{nxt}.md" in taken`),
never computed from the input name. Fix verified by execution: `…-7.md` now splits into
itself + `…-10.md`.

## Detection and recovery

⭐⭐ **The tell was in the output I had already read and skimmed past** — the printed target
names did not contain the number of the file I passed in. **When a tool echoes its output
paths, read them as a claim about what it will destroy, not as progress.** `=== $p` followed
by `WROTE` to a *different* stem is the whole signature.

⭐⭐⭐ **The recovery invariant is content-level, not file-level.** "Are the files back?" is
answerable and useless (sizes can match while content is wrong). The right check compared the
set of *cited atom stems* across the whole directory, before vs after, using the previous
day's published sync as the reference:

```
kb-yesterday cited stems: 2277   shared-now: 2317
LOST (cited yesterday, absent now): 0     GAINED: 40
```

`0 lost / +40 gained` proves both that the restore worked and that the run's real work
survived. ⚠️ **A control is required here:** files *not* touched that day came back `DIFF`
kb-vs-shared (20458 vs 20543 B) because the published copy carries a link fixup
(`](wiki/…)` → `](../…)`). So **byte-identity is the wrong comparison against a published
mirror** — reverse the known transform first (`sed 's|](\.\./learnings/|](wiki/learnings/|g'`),
or compare a transform-invariant projection like the citation set.

⇒ **Yesterday's published sync is a usable backup only because the sync is daily and
append-mostly.** That is a property of this pipeline, not a general one — a store synced
weekly, or one where a page is rewritten in place, does not give you this.

Related: [[feedback_git_checkout_file_destroys_uncommitted_work]] (shared: `1785827515719-git-checkout-file-destroys-uncommitted-work-recove`) (same family — a routine
verb with a destructive arm), and the shared-clone safety concept page synthesized this same
night, whose rule *"never put the safety check and the destructive action in the same
command"* is the generalization this instance instantiates.

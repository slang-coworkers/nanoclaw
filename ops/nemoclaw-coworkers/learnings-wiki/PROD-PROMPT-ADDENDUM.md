# PROD prompt addendum: naming by meaning, consolidation, CANDIDATE / SHAPE

The same fold rules `prompt.md` just gained, written against the PROD prompt so they can be pasted
verbatim. Target: series `task-1782828347850-4m9u23` on `slang-coworkers-prod` (agent group
`ag-1776713211742-1w6l4e`, `0 6 * * *`), whose committed copy is
`docs/scheduled-tasks.slang-coworkers-prod.{json,md}`.

**Do not hand-edit those two files.** They are a sealed snapshot pair. Edit the live task
(`ncl tasks update`, or the dashboard), then re-dump on the box:

```bash
python3 scripts/dump-scheduled-tasks.py            # rewrites the .json + .md pair
python3 scripts/dump-scheduled-tasks.py --check    # must exit 0: snapshot_id matches
```

Four edits, all inside PART A except the last. PART A step numbering stays as it is: the BACKLOG
GUARD paragraph references "step 5" twice, so the new work goes in as `4a` / `4b` rather than
renumbering.

---

## 1. PART A step 2: what to read out of `finalize`

FIND (start of the line; the parenthetical that follows it stays):

```
2. python3 .learnings_wiki.py finalize — note UNCOVERED, OVERSIZE and NO-TLDR.
```

REPLACE WITH:

```
2. python3 .learnings_wiki.py finalize — note UNCOVERED, OVERSIZE and NO-TLDR, plus the shape reports: NUMBERED-SPLIT, CANDIDATE-SUPERSESSION (plus CANDIDATE-SUPERSESSION-TRUNCATED if the pair scan stopped early, which makes that list a partial slice to re-read next run), CANDIDATE-CORRECTION, VOCAB and the single SHAPE line. Those are reports, not failures: the builder surfaces them, you act on them (steps 4a/4b).
```

---

## 2. PART A step 3: the PAGE CAP bullet becomes naming by meaning

FIND (one line, the third bullet under step 3):

```
   - PAGE CAP 40 KB. Create a new concept page if a learning opens a genuinely new topic, OR if the target page is at the cap — then SPLIT by subtopic (<group>-<subtopic>-2.md). Never let a page exceed 40 KB: past ~56 KB the Read tool silently truncates it and the tail never reaches the reader. Growth belongs in page COUNT, never page SIZE.
```

REPLACE WITH:

```
   - PAGE CAP 40 KB, and pages are NAMED BY MEANING. A concept page is <group>-<subtopic>.md where <subtopic> is a noun phrase a reader can pick out of the index (ci-runners-flake-triage, review-pr-head-binding). NUMBERED SUFFIXES (-2, -3) ARE FORBIDDEN for new pages: a number names nothing except the overflow of something else, and prod already carries 66 such pages (general-misc-state-verification-discipline-1..13, review-pr-practices-1..9) where finding one rule means opening the whole family. Create a new page if a learning opens a genuinely new topic, OR if the target page is at the cap, and in that case SPLIT IT BY THEME: read the page, name the two or three subjects actually inside it, and write each out as its own named page with its own TL;DR. The cap is the trigger, the theme is the boundary. Never let a page exceed 40 KB: past ~56 KB the Read tool silently truncates it and the tail never reaches the reader. Growth belongs in page COUNT, never page SIZE, and never in a numbered tail.
```

---

## 3. PART A: insert steps 4a and 4b

FIND the end of step 4 and the start of step 5:

```
   today's atoms did not touch them. Splitting only the page you folded into leaves the biggest
   and most-read pages over cap indefinitely.

5. BOUNDED WORK PER RUN
```

REPLACE WITH (the two new steps sit between them; step 5's own line is unchanged):

```
   today's atoms did not touch them. Splitting only the page you folded into leaves the biggest
   and most-read pages over cap indefinitely.
4a. CONSOLIDATE ONE NUMBERED FAMILY PER RUN, AT MOST 4 OF ITS PAGES. finalize reports each
   <x>-2.md / <x>-3.md page that has a sibling as NUMBERED-SPLIT: those were split by SIZE, so one
   rule is spread over the family and the reader has to open all of it to find it. Take the FIRST
   family reported (X-1.md ... X-k.md), read up to four of its pages, and rewrite those as pages
   named for the subjects they actually hold, each with its own TL;DR and each under 40 KB. Carry
   every citation across with the paragraph that cites it, retire the duplicates the merge exposes
   (python3 .learnings_wiki.py retire <old> <new>) instead of keeping both rows, and delete a
   numbered page only once its content lives on a named one. ONE family per run bounds the scope and
   FOUR pages bounds the cost: general-misc-state-verification-discipline-1..13 at the 40 KB cap is
   half a megabyte of reading before a word is rewritten. Spawn a bounded subagent for the rewrite
   (as the BACKLOG GUARD does for the fan-out) if the pages are large, and finish the rest of the
   family on later runs; a half-migrated family reads worse than an untouched one, so leave the pages
   you did not reach numbered.
4b. ACT ON THE CANDIDATES. The builder only surfaces them; deciding is your job.
   - CANDIDATE-SUPERSESSION <old> ~ <new> (jaccard=..): two live atoms whose titles say nearly the
     same thing, OLDER STEM FIRST. Read both, then either rewrite the single paragraph that states
     the current truth and run retire <old> <new>, or leave both live because they only look alike.
     This is the queue that keeps the wiki bounded: this KB carries 251 self-declared corrections
     and 39 duplicate slugs against 3 lineage edges, because nothing ever put a pair in front of
     the fold.
   - CANDIDATE-CORRECTION <stem>: an atom announcing itself as a correction. Find what it corrects
     and retire THAT atom, never the correction.
   - VOCAB <stem> <tokens>: an atom that fell through to misc, with the words that put it there.
     Recurring tokens are a theme the vocabulary does not name. REPORT them, do not write a
     .wiki-config.json on this install: this KB has none, so it runs on the built-in Slang tables,
     and a config that names "topics" or "groups" REPLACES those tables wholesale rather than adding
     to them, which would re-bucket all ~5,800 atoms on the next build.
     Extending the vocabulary here is an operator change (copy the defaults out of the skill first),
     not a fold-time one.

5. BOUNDED WORK PER RUN
```

---

## 4. Two counts to carry: the per-run bound and the report

FIND (PART A step 5):

```
Cap this run at ~40 uncovered folded, at most 2 page splits, and at most 5 TL;DR backfills. Report what remains.
```

REPLACE WITH:

```
Cap this run at ~40 uncovered folded, at most 2 page splits, at most 1 numbered family consolidated (at most 4 of its pages), and at most 5 TL;DR backfills. Report what remains.
```

FIND (PART A step 6):

```
6. Re-run python3 .learnings_wiki.py finalize — confirm 0 dangling, uncovered decreasing, and OVERSIZE / NO-TLDR counts not increasing.
```

REPLACE WITH:

```
6. Re-run python3 .learnings_wiki.py finalize — confirm no WIKI-CONFIG-ERROR (non-fatal, exit 0, so nothing else catches a bad config and the run's folding was done against the wrong buckets), 0 dangling, uncovered decreasing, OVERSIZE / NO-TLDR counts not increasing, numbered_pages not increasing, and the SHAPE line's bytes_per_atom flat or falling. Climbing bytes_per_atom means the run inventoried instead of synthesizing: the fix is more supersession and more consolidation, not a bigger page.
```

FIND (PART B step 11, the last line of the prompt):

```
11. Report: learnings count, concepts count, uncovered folded, PR number, merge sha/status.
```

REPLACE WITH:

```
11. Report: learnings count, concepts count, uncovered folded, bytes_per_atom <before>→<after>, numbered_pages <n>, PR number, merge sha/status. The two SHAPE numbers are what tell a human whether the nightly fold is synthesizing or inventorying, so they belong in the line nobody has to open the wiki to read.
```

---

## After pasting

1. `ncl tasks get task-1782828347850-4m9u23` and read the prompt back: PART A must still run 0, 1,
   2, 3, 4, 4a, 4b, 5, 6, and the BACKLOG GUARD's two "step 5" references must still point at the
   bounded-work step.
2. Re-dump and `--check` the snapshot pair (commands at the top).
3. First run to watch is the next 06:00 UTC fire. Expect the report line to gain `bytes_per_atom`
   and `numbered_pages`, and `numbered_pages` to fall by one family per run from 66 pages.

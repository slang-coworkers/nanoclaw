---
name: feedback_orphan_check_races_a_concurrent_writer
description: "An ORPHANED=1 from reindex.sh can be a snapshot of a CONCURRENT SIBLING SESSION of your own agent group mid-write, not a defect (cross-group writes are impossible — separate binds). Measured 2026-08-06: leaf written 06:42:21, its index row 06:43:09 — I audited inside that 48s gap and got a true reading of an inconsistent store. Re-run before investigating; leaf count changing between runs (797 then 799) is the tell."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

Two sessions write this store — **both of them mine.** `reindex.sh --check` is not atomic with respect
to the other one, and
a leaf is created ~48s before its index row is regenerated. Auditing inside that window reports
`ORPHANED=1` — **a correct measurement of a store that is legitimately inconsistent at that instant.**

Measured, on `feedback_a_finding_against_a_superseded_head_needs_re_siting`:

| observation | value |
|---|---|
| leaf mtime | `06:42:21` |
| its index row (`index-feedback-1.md`) mtime | `06:43:09` |
| my check | ran between them |
| verdict then / 30s later | `ORPHANED=1` / **`ORPHANED=0`** |
| `leaves=` across the two runs | **797 → 799** |
| leaf's `originSessionId` | `0dacff7c…` — **a SIBLING session of my own group**, not my peer's |

⭐⭐⭐ **The tell is the DENOMINATOR MOVING, not the finding.** `leaves=` rose 797→799 between two
runs seconds apart. A store only I write has a stable population; a changing population means the
audit and the writer overlap, and **every count in that run describes a store that no longer exists.**
Check the denominator's stability before interpreting any single-item finding.

⭐⭐ **I spent five tool calls hunting an instrument defect that wasn't there.** The link was
well-formed, at offset 12,380 in a shard `MEMORY.md` links, readable under every scope — and I read
that as *"reachable by every scope yet reported orphaned, therefore the tool is wrong,"* going as far
as re-implementing its walk. The walk agreed with me because by then the row existed. **Re-running the
cheap check costs 2s and discriminates race-from-defect immediately; re-deriving the instrument costs
five calls and cannot, because the second derivation runs against the repaired state.**

⇒ Order of operations for any single-item audit finding: **(1) re-run, (2) compare the denominator,
(3) check the artifact's `originSessionId` and mtime against your own session, (4) only then suspect
the instrument.** Companion to [[technique_keeping_this_store_reachable]] (whose orphan-count rules
all assume a single writer) and [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (the
converse: an instrument failing toward a finding that licenses work).

## ⛔ CORRECTION — the concurrent writer is MY OWN SIBLING SESSION, not the peer

I told the peer its session had made the racing write. It checked and refuted:
`feedback_a_finding_against_a_superseded_head_needs_re_siting` exists in neither of its roots, its
session id is `46a01fc5…`, and its `/home/node/.claude` bind is `ag-1780667166418-apezq5` against my
`ag-1776713211742-1w6l4e` — **cross-group writes are structurally impossible.**

Verified on my side: `0dacff7c-b2e0-4955-93f6-07f27abcd3f8.jsonl` is a transcript **in my own project
directory** (`/home/node/.claude/projects/-workspace-agent/`, 968 transcripts), last written 06:42:57
— seconds before the leaf appeared. `container.json` confirms `agentGroupId ag-1776713211742-1w6l4e`.

⭐⭐⭐ **The race is real; my attribution of it was not — and the mount facts I already held ruled the
peer out before I asked.** [[feedback_identical_paths_hold_different_files_per_agent_group]] says these
binds are per-agent-group. A file appearing in my store therefore has a writer *inside my own group*,
by construction: the peer was excluded a priori. **I reached for the visible counterparty instead of
the structural constraint I had already recorded.**

⭐⭐ **A `originSessionId` that isn't mine means "not this session," never "not this agent."** One
agent group runs many concurrent sessions; the id discriminates sessions, and I read it as
discriminating agents. The check that settles it is one `ls` in my own project dir.

⚠️ **The peer's framing of why it checked:** *"a confession is the least-audited claim in the room."*
I volunteered blame, which reads as diligence and is therefore waved through — the reviewer relaxes
exactly where a claim happens to be self-directed. **Self-blame needs the same evidence as blame.**

## ⛔ Second correction — the 2,016 headroom figure was MINE

I told the peer its carried-forward `2,016 and tightening` was a stale figure of its own. It was
**my** number, reported by me in msgs 132 and 136; the peer carried it verbatim *and attributed it*.

⭐⭐⭐ **Both 2,016 and 5,372 are measurements of a file on my private bind that the peer cannot read.
Quoting a peer's private-store number back to them is quoting a TIMESTAMP, not a state** — the
moving-denominator rule applied across stores. When a peer cites a figure about my store, the only
correct response is to re-measure and report, never to characterize their copy as stale: they have no
copy.

## ⭐⭐⭐ A STABILITY CHECK HAS AN IMPLICIT TIME APERTURE

The peer applied my race finding to its own roots and its first probe said clean: `leaves=706` on
three runs, 2 s apart. **Which proves nothing — the window was smaller than the write interval.**
Widening it found `triage-12371.md` (98,274 B) modified 06:46:29 and `triage-12360.md` within the hour,
neither written by it. Its roots are concurrently written; 2 seconds could not see it.

⭐⭐⭐ **Quoting stability without the observation window is the same defect as quoting a count without
its denominator.** "Stable across 3 runs" is a claim about an interval, and the interval is the part
that decides whether the claim means anything.

Measured on my roots, same question at four apertures:

| aperture | files written |
|---|---|
| last 2 s | **0** |
| last 5 min | 27 |
| last 1 hour | 56 |
| last 6 hours | 110 |

Write cadence in the last hour: **56 writes, median gap 11 s, min 0 s, max 1,011 s.**

⇒ **My 2 s re-run rule is under-specified: it beats the median gap (11 s) only by luck of timing, and
is far under the max (1,011 s).** The re-run discriminates *this* race because I knew the leaf-then-
index gap was 48 s; it does not certify a quiet store. **To claim quiescence, state the aperture and
make it exceed the max inter-write gap you have measured — otherwise report "stable over 2 s," which is
honest and nearly worthless.**

⭐⭐ Corollary: a store with a 1,011 s max gap **cannot** be certified quiet by any probe I would
willingly wait for. The right posture is not "verify quiet" but **"assume concurrent, re-run, and
compare denominators"** — cheap, and it does not depend on a window at all.

## ⛔ THIRD CORRECTION — `originSessionId` RECORDS CREATION, NOT THE LAST WRITE

The peer found its writer filter wrong "in the flattering direction": it classified writers by whether
`originSessionId: <its id>` appears in a file's head, but **indexes and aggregate logs carry no
frontmatter at all**, so files it had just written scored as someone else's — fabricating support for
the very hypothesis under test. I ran the same filter on my roots and hit *two* defects, the second
worse.

**Defect 1 — absent field read as a counter-value** (its finding, reproduced):

| files written in my last hour | 62 |
|---|---|
| carry `originSessionId` | 36 |
| **no such field at all** (every one an `index-*.md` I wrote myself) | **26** |

**Defect 2 — mine, and it invalidates the whole classification:** of the 36 attributable files, the
filter said **2 mine / 34 sibling**, across **20 distinct session ids**. I wrote far more than 2 this
hour, so the partition is wrong on its face. The proof:

```
technique_keeping_this_store_reachable.md   originSessionId=9872-scrub-redrive   mtime=06:41:48
```

**I appended that section myself at 06:41 in session `5c386752…`.** The field names the session that
**created** the file; it is never updated by later writes.

⭐⭐⭐ **`originSessionId` is a birth certificate, not a modification log — so it cannot answer "who
wrote this recently," which is the only question a race investigation asks.** For an
append-heavy store, most files are created once and edited many times, so the field disagrees with
mtime by design. My earlier conclusion (*"an id that isn't mine means not-this-session"*) was still too
generous: it means **not-this-session-CREATED-IT**, and says nothing about the write I am looking at.

⇒ **Both of my racing-writer conclusions were reached with an instrument that cannot see writes.** The
`0dacff7c…` attribution happened to be right (that leaf was newly created, so birth == write), which is
the worst case — **a correct answer from an invalid method, which certifies the method.** The
sibling-vs-mine *rates* derived from the same field are void; I am not restating them.

⭐⭐ **Ask what a field is a fact ABOUT before using it as a discriminator.** The peer's version:
*check the attribution field EXISTS in the class of file you're attributing; an absent field is not a
counter-value.* Mine, one level deeper: **a present field can be a fact about a different event than
the one you're investigating.** Absent → unattributable; present → attributable *to creation only*.

✅ What actually answers "who wrote this recently": mtime for **when**, and for **who**, nothing in the
store — the transcript directory listing (`ls ~/.claude/projects/-workspace-agent/*.jsonl`) plus write
timing. Which is why the no-window posture is the right one: **assume concurrent, re-run, compare
denominators** — it needs neither an aperture nor an attribution field.

## ⭐⭐ A WINDOW WIDER THAN THE EVENT FILLS THE RESULT WITH UNRELATED ROWS

The peer's first pass at the birth-vs-write test used a 24-hour aperture and surfaced 27 "foreign
session" files — **all from the previous day, hours outside its session.** Narrowed to its actual
3-hour span: population 13, of which exactly **1** was the real birth-vs-write proof. Its framing:
*a window wider than the event under investigation fills the result with unrelated rows that read as
findings* — the arming-denominator failure on the time axis.

Mine had the same defect, milder, and I did not notice it while writing the section above:

| aperture | population |
|---|---|
| 1 hour (**what I used**) | **53** |
| 25 min (my session's actual span) | 35 |
| 10 min | 28 |

I attributed writes across 62 files when only ~35 could possibly relate to my session. The extra rows
were real files with real mtimes — **nothing was fabricated, which is why it reads as a larger finding
rather than a wrong one.**

⇒ **Set the window to the event, not to a round number.** "Last hour" is a habit, not a measurement;
the correct aperture is the span of the thing being investigated. Pairs with the opposite error two
sections up (a 2 s window narrower than the 1,011 s write gap): **too narrow hides the mechanism, too
wide manufactures population.** Both are answered by the one conclusion no instrument defect in this
exchange touched — **assume concurrent, re-run, compare denominators** — which needs no aperture and no
attribution field.

## The full ladder, for retrieval

The peer's decisive instance: it patched a wikilink in `project_issue_12007.md` at 05:49:07 (verified
from content — new link form present, zero of the old) and **that file's `originSessionId` is
`564c5437-…`, a different session.** Creation-only, confirmed on both edges.

1. "not my id ⇒ not me" — **wrong** (absent fields exist; the peer's defect)
2. "not my id ⇒ not this session" — **still wrong** (one group, many sessions; my first sharpening)
3. ⭐ **"not my id ⇒ this session did not CREATE it"** — correct, and says nothing about the write
   under investigation

Every rate either of us derived from that field is void. Neither of us restated ours.

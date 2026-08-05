---
name: feedback_compaction_target_yields_to_load_bearing_content
description: "A size target is advisory; verbatim commands, IDs and resume triggers are not compressible. Stop at the floor and say so."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# A compaction target is advisory; load-bearing content is not compressible

## ⛔ SOLE HOLDER — CROSS-SESSION APPEND. Read before compacting this file.

⚠️**This file is owned by `originSessionId: f6981402-…`, but `main-2026-08-04` appended to it.** If you
are the owner and did not write the sections below, that is why. **Two rules exist ONLY here** (checked
across the whole memory dir; both were derived 2026-08-04 and both prevent silent loss of chain rows):

| sole-copy rule | what it prevents |
|---|---|
| **MEASURE ROW OFFSETS, NOT FILE SIZE** — a row can start below a truncation bound and end above it, so only shrinking what *precedes* it helps | the actual exposure that seven size-measurement mechanisms all missed |
| **A SHRINKING FILE DISARMS A CANARY WITHOUT CHANGING A WORD OF IT** | a detector degrading into a confident false negative while its text still reads as a passing test |

⛔**Do not delete either without first landing it elsewhere and verifying the exact wording arrived.**
⭐⭐**Why this banner exists: a file in a memory dir is NOT evidence of who wrote it.** Appending to
another session's file makes the content look like the owner's; the owner can then compact it away
without knowing the stake. **`originSessionId` is the owner, not the author of every line** — check it
before citing a file as your own prior finding, and banner the stake when you append across sessions.

## ✅ LIFEBOAT LINKS — files whose ONLY inbound path was an index row past the truncation bound
These are here to give each file a **second parent** that survives a tail cut (this file is reachable from the
index header, i.e. above every candidate bound). Adding a path is the mitigation; deleting a row is not.
- [[feedback_a_correct_conclusion_does_not_certify_its_recipe]] — a true conclusion certifies neither the
  mechanism nor the **recipe**; audit the reproduction path separately.
- [[feedback_stop_a_converged_exchange_the_yield_curve_bends]] — a productive loop is the hardest to leave.

⭐**Measured 08-04:** at a 24,400 B cut, **26 files had zero surviving parent** — the entire chain-routing layer.
Linking the 4 topic indexes from the index header took it to **2**; these two entries take it to **0**.
⇒ ⭐⭐⭐**The harm is UNREACHABILITY, not bytes. Fix it by ADDING a path, never by deleting a row** — and re-run the
transitive-closure check after any spill, because **a new child whose only parent sits past the bound is born dark.**

## Rules for compacting a SHARED index (spilled from `MEMORY.md` line 3, 2026-08-04)

⛔⭐⭐**AT THE FLOOR THE ONLY REAL LEVER IS SPILLOVER, NOT DELETION.** When an index is already at its
floor, **move the LOWEST-PRIORITY LIVE ROWS to a single-topic child and leave ONE 📁 pointer row** —
the way the parked / shipped / long-tail children already work. ⛔**Never drop a row to hit a
number.** **Shorten rows, never DROP one — a dropped row makes its child unreachable** (observed:
#11616 went dark 7 weeks with its memo on disk but no index row; #10918 sat unindexed). ⭐**Confirm
the child holds the detail BEFORE shortening any line** — **grep the exact digits and phrases**, not
by assuming the child "covers the topic" (property 4), **case-insensitively**, asking whether a hit
carries the RULE or merely the WORD. ⭐⭐**A probe that answers "no" to everything is not evidence** —
assert its scope and run a non-zero control first.

⛔⭐⭐⭐**"24.4KB" IS AMBIGUOUS — 24,400 B (decimal) vs 24,985 B (KiB) — AND THE GAP IS WHERE BOTH OUR
FILES SAT.** A peer was silently reading it as decimal while its file was at 24,909 B: **under one
reading, over the other.** Under the strict reading two of its rows overflowed, including the #8306
row written that day and the pointer to its entire pre-#11920 backlog. ⇒ **Never reason about a
KB-stated bound without resolving the divisor; when unresolved, protect against the STRICTER one.**
⭐⭐⭐**This retires the "N misfires" framing entirely: the nag's FIGURE was never the interesting part
— FILE SIZE WAS THE WRONG INSTRUMENT FOR THE QUESTION, and no amount of re-measuring size would ever
have revealed it.** Seven mechanisms died chasing the figure; **one offset measurement found the
actual exposure.** ⭐⭐**When repeated measurement of a quantity keeps failing, suspect you are
measuring the wrong QUANTITY** — not that you need a better measurement of it.

⛔⭐⭐⭐**A SHRINKING FILE DISARMS A CANARY WITHOUT CHANGING A WORD OF IT.** Hours after I placed one, a
**sibling session** measured MARKER-B at ~23,947 — **below both bounds** — because the file shrank when
#12246 retired to the shipped index. The marker text still read like a live passing test. ⇒ **A canary
is evidence ONLY while it sits past the threshold; re-measure its offset before citing it, and make the
canary state its own precondition so it reads as inert when it is.** ⭐⭐**A detector whose validity
depends on a quantity that drifts must publish the check that proves it is still armed** — otherwise it
degrades into a confident false negative, the worst failure direction. Mine now carries a runnable
one-liner and names its re-arm threshold.

⭐⭐**Also: a row-count DROP is not necessarily a loss.** 28→27 alarmed me into hunting a dropped chain
row; the true cause was **#12246 MERGING** (skiminki-nv, `645ac5eef2b1`, 12:15Z) and a sibling
correctly retiring it live→shipped with its child intact. **Verify the destination before treating a
count change as damage** — and note this is only checkable because the retirement left a trail.

**Tail-canary design, so a future session can answer this for free** (my container, 2026-08-04):
chain rows end at **24,387** — clear of *both* readings — and two markers straddle the gap:
**MARKER-A** past decimal only (@24,786), **MARKER-B** past KiB too (@25,197), with the true file
size self-stamped. Reading A but not B localizes truncation *between* the readings; rows present
without B confirms truncation. ⚠️**A single marker below the KiB bound cannot prove the file wasn't
truncated there** — my first attempt made exactly that error, asserting a no-truncation conclusion
from a marker that would have survived the truncation it claimed to rule out. ⚠️**Canary state is
per-container: a peer whose index sits fully under both bounds has nothing past the tail to
sacrifice, so adding one would push it back over.** Do not port the canary; port the offset check.

## ✅⭐⭐⭐ THE CHECK THAT RETIRES THE ALARM: SIMULATE THE TRUNCATION AND DIFF REACHABILITY

After many turns of shaving prose to pull rows under the bound, one measurement answered the actual
question — **what would truncation COST?** Truncate a copy at the bound, recompute the transitive
closure from the surviving text, and diff:

```
python3 - <<'EOF'
import re,os
files={f for f in os.listdir('.') if f.endswith('.md')}
def lk(s):
    o={m.split('#')[0].split('/')[-1] for m in re.findall(r'\]\(([^)]+)\)',s)}
    o|={m.strip()+'.md' for m in re.findall(r'\[\[([^\]]+)\]\]',s)}
    return {x for x in o if x in files}
def clo(seed):
    seen=set(seed); st=list(seed)
    while st:
        s=open(st.pop(),encoding='utf-8',errors='replace').read()
        for t in lk(s):
            if t not in seen: seen.add(t); st.append(t)
    return seen
d=open('MEMORY.md','rb').read()
full=clo(lk(d.decode('utf-8','ignore')))
tr  =clo(lk(d[:24400].decode('utf-8','ignore')))
print(len(full), len(tr), sorted(full-tr))
EOF
```

**Result on my store 2026-08-04: 374 reachable either way — ZERO files would go dark.** The two rows
sitting past the bound are `📁` pointers whose children have **alternate inbound paths**
(`slang-parked-index` ← the grep-asymmetry lesson; `slang-shipped-index` ← the frontend-docs index).

⭐⭐⭐**AN EXPOSED ROW IS NOT A LOSS — REDUNDANT LINKING ABSORBS TRUNCATION.** I spent many turns treating
byte-offset exposure as the harm, when the harm is *unreachability*, and those are different claims.
⭐⭐**Measure the CONSEQUENCE, not the proxy: "is this row past the bound?" is a proxy; "would anything
become unreachable?" is the question.** The proxy is cheap and was worth watching, but it kept firing
after the underlying risk was already absorbed — and each firing pulled another edit out of me.
⭐⭐**A DAG with multiple paths to each child is the real mitigation**; single-parent trees are what make
truncation lossy. Prefer linking a child from its topic index *and* from any lesson that cites it.

⛔⭐⭐**MEASURE ROW OFFSETS, NOT JUST FILE SIZE.** A row can START below a truncation bound and END
above it — then shortening *that row* cannot protect it; only reducing what **precedes** it can.
Observed 2026-08-04: the `rhi#800` row began at byte 24,353 and ran 397 B past the 24.4KB bound, so
trimming the row itself left it exposed. Enumerate exposure by offset, never by file size:

```
python3 -c "
d=open('MEMORY.md','rb').read(); off=0
for ln in d.split(b'\n'):
    e=off+len(ln)
    if ln.startswith(b'- ') and e>24400: print(off, ln[:60])
    off=e+1"
```

⭐⭐**When a query proves unreliable, re-run every load-bearing claim that used it — PUBLIC ONES
FIRST.** Bookkeeping errors cost a stale note; a published claim is in front of a maintainer. On
2026-08-04 a peer's `--since`-derived SHA had already reached jkwak in a GitHub comment, and it was
caught only by applying a memory-hygiene lesson to a *public* artifact rather than filing it and
moving on. **Verify-claimed-artifacts applies to your own artifacts too.**

⛔⭐⭐**MEASURE YOUR OWN FILE, NOW — carry NO byte/row figures in an index line.** A prior version
asserted *"Live chains = 12.5KB / 31 rows, lesson rows 6.5KB"*: **unreproducible.** I measured
**9,919 B / 24 rows**, and a peer's copy had **0 hits** for those digits ⇒ **a SIBLING session wrote
it, not me.** ⭐⭐**A fabricated figure inside a lesson that STEERS compaction is a vector — the next
sibling to compact reads it having never seen the exchange that refuted it.** ⇒ verbatim, every time:
`wc -c` the file, `awk '/^## Live/,/^## Held/' | grep -c '^- '` the section.

⭐⭐**SIBLING SESSIONS OF YOUR OWN AGENT GROUP SHARE YOUR CONTAINER AND FILESYSTEM — this file is NOT
a convergeable target.** Evidence (absolute-pinned, enumerated): in the window 10:45–11:00 on
2026-08-04, **11 files** were written in my memory dir and I authored **two**. ⇒ **anchor-checked
in-place patches; re-measure after EVERY edit; never report a size as a number you control.**

⭐**Trim your OWN newest line first.** On 2026-08-04 roughly **2.4KB** of line-3 growth was **NAG
COMMENTARY about the compaction trigger, not chain state** — the self-referential meta-work was the
bloat, so trimming my own newest content cost nothing load-bearing. ⭐⭐**Re-read the child before
acting on a 🔴 row — a stale alarm outlives the thing it alarms about.**

## ⛔ 2026-08-04 — THE 24.4KB BOUND IS UNVERIFIED IN BOTH DIRECTIONS (spilled from `MEMORY.md` line 3)

A prior version of the index line asserted: *"THE 24.4KB read limit IS NOT A READ CUTOFF — **I
TESTED IT, don't re-litigate**"*, citing a `Read` that returned line 117 intact at byte **59,029**
of a **73,635 B** file (3.6× the figure; controls: unique-string 1, absent-string 0; a peer read
**321,511 B**). **That result stands — for the `Read` tool.**

**It is not what the nag asserts.** The nag's own text says content is dropped **when this index is
LOADED**, i.e. the **SessionStart injection** path (per
`/workspace/agent/memory/system/definition.md`, the index + definition are injected at
startup/clear/compaction). ⭐⭐⭐**Different instrument, different path — the refutation never touched
the asserted mechanism**, yet it carried a **"don't re-litigate" LOCK** that foreclosed checking the
only path that actually loads this file.

⛔⭐⭐⭐**A "don't re-litigate" tag is a claim about COVERAGE, not confidence. Never attach one unless
the test hit the asserted path.** A wrong number misleads one reader; a wrong *don't-check* directive
disables the check indefinitely. ⭐⭐**The tell is not how confident the line reads but whether it
names an INSTRUMENT and a PATH at all** — mine named neither, which is why it survived hours of
re-reading. (A peer's *"the bound is measured-false, 6 misfires"* cites a **count** and no path —
a count is the most convincing thing you can put in a claim that is orthogonal to coverage.)

⚠️**Unprobeable from inside a session where injection has already run** ⇒ **unverified, not false.**
**Still never compact on the nag's authority** — but the honest reason to spill is that this index's
tail carries ~30 chains' routing state and load-path truncation cannot be ruled out. **Escalated to
the operator as needing host-side observation of the SessionStart injection path.**

**2026-08-03.** A `PostToolUse` hook told me to compact `MEMORY.md` from 19.9KB to
**under 17.1KB**. I got it from 21.0KB → 19.8KB and **stopped above the target
deliberately**. That was the right call, and the turn produced two proofs of why.

## What made stopping correct
Two Mode-4 near-misses inside one compaction pass:

1. **I ellipsized a lesson whose entire point was the command.** Line 8 says
   *"Record the CHECK TO RUN, not the conclusion"* — and I compacted it by replacing
   `gh api repos/O/R/compare/<tag>...<sha> --jq .status` + the `SGL_SLANG_VERSION`
   pin-file path with the phrase *"verbatim commands in the chain."* A linter restored
   them with the note **"don't ellipsize the command — a lesson saying 'record the
   check' must CONTAIN it."** Correct: a pointer to a command costs a file-open at the
   exact moment you need the command, which is precisely what the lesson exists to
   prevent.
2. **A 🔴 row was chasing a debt already paid.** `#12219`'s index line read *"float→int
   follow-up DUE and NOT FILED, gate fired, missed 2 days."* The child recorded it
   **FULLY DISCHARGED — empirically fixed**, with the real (narrower, width-mismatch)
   residual tracked on #12186 comment `5150492632`. The row's own warning —
   *"check the act path FIRST"* — fired on itself. Fixed the row.

⇒ ⭐⭐**Re-read the child before acting on a red index row. A stale alarm outlives
the thing it alarms about**, and it looks identical to a live one.

## The rule
**Compact prose; never compact these:**
- verbatim commands and flags (the reason the note exists)
- identifiers you'd otherwise have to re-derive: SHAs, PR/issue/comment IDs, `file:line`
- RESUME triggers on live chains, and the ⛔/⚠️ traps that prevent a wrong action

**Sequence that worked:** dead-link sweep first (0 dead / 38 entries intact) → for each
candidate line, `grep` the child for the specific fact → only then shorten → re-verify
links and spot-check that named commands/IDs survived (`grep -c 'check_suite.id'` etc.).

⭐**Trim your own newest entry first.** The longest line in the file was one I had
written minutes earlier; being freshly-authored is not a claim to space.

⇒ ⭐⭐**When the floor is above the target, stop and say so** rather than deleting
load-bearing content to satisfy a number. A hook optimizes bytes; it cannot see which
byte is the one that prevents a wrong merge. Report the floor and why — an index that
fits the limit but has lost its commands has failed at being an index.

## 2026-08-04 — second pass. The "is it in the child?" probe is ITSELF an instrument that lies.

Same hook, 23.8KB → **18.6KB**, target 17.1KB. Stopped above it again, deliberately. What's new is
**how the safety check failed**, in both directions, in one pass:

I probed 20+ fragments with `grep -ciF '<exact index phrasing>'` against each child. **Nine came
back 0.** Running the ladder (shorter stem → `-E` alternation → synonym) showed:

- **Six were PHRASING VARIANTS, not absences** — `doesn't` vs `does not`, `V1/V2` vs
  `Variants 1 & 2`, `ECHOED script text` vs `echo`, `2 gaps NEITHER FILED` vs `no issue filed`.
  Had I trusted the zeros, I'd have "rescued" content that was already safe — wasted bytes, and a
  false sense that the index was the only copy.
- **Three were REAL Mode 4** — the fragment existed *only* in the index line. The sharpest:
  **`cmt 5062894889 = bot's ⇒ EDIT-in-place` on #12145.** The child recorded the comment id and that
  it was ours, but never the *consequence* — that a refresh must `PATCH`, never `POST`. One
  "move detail to the child" edit would have deleted the only copy of an operational rule that
  prevents a bot-on-bot echo. I wrote it into the child first, then trimmed the row.

⇒ ⭐⭐**The check that authorizes a deletion needs the same rigor as the claim it's checking.** An
exact-string probe over a child is a *narrower* instrument than the prose it's testing; a 0 from it
means *"my probe missed"* at least as often as *"the content is gone."* **Ladder every zero before
you delete on the strength of it** — and note the asymmetry that decides the default:
a false 0 costs bytes, a false non-zero costs the content permanently. **When the ladder is
ambiguous, write it to the child anyway** — duplication is cheap, deletion isn't.

⭐ **Second structural win worth reusing: fold pointer-only rows before trimming substantive ones.**
Five rows whose entire content was a link went to [[slang-longtail-chains-index]] — costs one hop,
risks nothing, because there was no prose to lose. Trimming a row that carries a SHA or a RESUME
trigger risks everything. **Sort compaction candidates by how little they'd lose, not by length.**

⭐ Also re-confirmed live rather than assumed: #12219 and slangpy#1051 really are `closed`, #12116 is
non-draft @`5c0e69c0c059`, #12014 still draft @`2e8c12db841f` (~26d). **Verifying state before
compacting a row is what lets you shorten it honestly** — three rows got *more* accurate, not just
shorter.

Related: [[project_gate_audit_shared_jsonl_mtime_race]] (same turn: an advisory
mechanism whose warning I over-trusted), [[project_12219_sccp_module_scope_composite_const_fold]],
[[slang-longtail-chains-index]], [[project_12145_gbufferrttexgrads_d3d12_access_violation]]
(where the rescued `EDIT-in-place` rule now lives).

📁 **Consolidated with the memory-file-health scan, the spill recipe and the row-count-vs-row-length lever: [[project_memory_files_over_read_limit_backlog]]** (that note already held the concurrent-writer EFFECT on trims at `:147`/`:158`; these sections are the mechanism + damage mode).

## ⛔⭐⭐⭐ A CONCURRENT WRITER CAN SPILL A **PRE-DECISION** COPY OF YOUR ROW — silent, and it looks like tidy compaction (2026-08-04)

I wrote a reasoned ownership decision into the `#9866` index row at ~08:17Z. At **08:24:53Z** `MEMORY.md`
went **23,337 → 19,563 bytes** — a sibling session compacted it and spilled that row into a new child
(`slang-frontend-docs-chains-index.md`). The spilled copy was the **version from before my edit**: the
row was preserved, the *decision* was gone. Both `ATTRIBUTION IS NOT DELEGATION` and `slice 2 UNFILED`
returned **0 hits** index-wide afterward.

⭐⭐⭐ **This is worse than a lost edit, because the result is well-formed.** No conflict, no error, no dead
link — a valid pointer row to a valid child holding a stale row. Every structural check I run (size,
dead links, row counts, pointer-row accuracy) **passed**. Nothing but reading the row's *content* could
find it. The failure survives exactly the audits designed to catch compaction damage.

⚠️ **Mechanism:** the other session read the file before my write and wrote after it — last-writer-wins on
a whole-file rewrite. My `Edit` calls had already failed twice this session with *"modified since read"*,
which was the early warning I under-read: I treated it as a linter, and it was **a peer editing the same
file.** The peer independently reported the same thing (its trims "saved ~0 bytes twice" while rows it
never wrote kept appearing).

⇒ **Rules:**
1. **After any external size change, re-read your own recent edits by CONTENT, not by file health.**
   Size + links + counts all passing is *not* evidence your content survived.
   ⛔⭐⭐**BUT THE RECOVERY AUDIT NEEDS THE SAME DISCIPLINE AS THE THING IT AUDITS — as first written, this
   rule said just "`grep -c '<the distinctive phrase>'`" and it MANUFACTURED A FALSE LOSS.** The triager
   ran it over 11 claims, got **0 hits** on one, and read it as my casualty. The claim was **intact** — the
   phrase existed only *hyphenated in frontmatter and in the filename*, so the probe searched for prose
   that was never in the body. ⭐⭐**A false "your work was destroyed" is the FALSE-NEGATIVE direction of
   this very defect, and it is the expensive one: it would have had them rewrite a file that was fine**
   (and, worse, re-derive a correct decision). ✅**Probe with a string you can SEE IN THE BODY, and clear
   the zero with a non-zero control before believing it:**
   ```bash
   grep -c '' FILE                     # CONTROL — non-zero, proves the file/instrument is live
   grep -ciF -e 'phrase from the BODY' FILE
   ```
   ⚠️**Never probe with a name/slug/heading-derived phrase** — frontmatter hyphenation, title-casing and
   filename slugs all differ from body prose. I shipped this rule to a peer WITHOUT the control clause
   while the same file says *a zero without a control is not evidence*; **a checklist I authored violated
   the root rule it was built from.**
1b. ⛔⭐⭐ **A CONDITIONAL PATCH THAT MISSES ITS ANCHOR IS A SILENT NO-OP — assert, never `if`.** Writing the
   fix above I used two `str.replace` calls in one script: the first asserted its anchor, the second was
   guarded `if s.count(old)==1:`. The second anchor had **already been rewritten by the concurrent writer**,
   so it matched nothing, the script printed `ok`, and I reported the edit as applied. Caught only by
   probing the phrase afterward with a control (`grep -ciF` → **0**, control `grep -c ''` → 49 lines live).
   ⭐⭐**A guard that lets a miss pass silently converts a detectable failure into an invisible one** — the
   same shape as an invented owner or a reconstructed identifier: a plausible substitute for a check.
   ✅ **Every anchored patch: `assert s.count(old)==1` and a non-zero exit on miss, then re-probe the new
   phrase with a control before claiming the edit landed.** On a contested file, an anchor written from an
   earlier read is stale by default — re-read immediately before patching.

2. **Put every load-bearing decision in the PROJECT/child file first, index row second.** The project file
   is single-owner and survived intact here; the index is contested and got rolled back. **The index is a
   pointer, never the only copy of a decision** — a corollary of the Mode-4 rule, now with a live receipt.
3. **A "modified since read" error is a CONCURRENCY SIGNAL, not a lint annoyance** — after two of them,
   assume a peer is live in the file and re-verify content after every write.
4. **When you find one rolled-back edit, audit the whole session's set.** I checked all 8 findings from
   this session; 7 were safe (they lived in single-owner feedback files) and only the index-resident one
   was lost — which is itself the argument for rule 2.

## ⛔ Header rules spilled from the MEMORY.md line-3 preamble (08-04) — these had NO other copy

The index header had grown to 2,024 B, mostly commentary about the nag. Condensed to a pointer; the
rules below were its **only** copy and now live here.

- ⛔**THE BOUND IS AMBIGUOUS AND UNVERIFIED IN BOTH DIRECTIONS.** "24.4KB" is either **24,400 B**
  (decimal) or **24,985 B** (KiB). Status: decimal — one armed datapoint against it; KiB — never
  tested; **SessionStart-INJECTION path — never tested** (the old refutation used the `Read` tool). 🔴**SUPERSEDED PATH ATTRIBUTION (08-04): the SessionStart/NanoClaw-hook path is SETTLED, not untested** — that hook demonstrably does not read `MEMORY.md` (`/app/src/memory/context.ts`; 0 hits in `/app/src`). **The UNTESTED mechanism is Claude Code NATIVE AUTO-MEMORY** (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`), which DOES inject this file. ⇒ **PROBE NATIVE AUTO-MEMORY, NOT SessionStart** — following the superseded wording sends you at the one path already proven irrelevant and leaves the real one untested. ✅The SHAPE survives: enumerate each interpretation and say which is ARMED vs UNTESTED.
  ⇒ **MEASURE ROW OFFSETS, NOT FILE SIZE** — a row can start below a bound and end above it, so only
  shrinking what **PRECEDES** it helps. See [[feedback_a_guard_can_be_inert_and_read_as_passing]] for
  why an untested threshold yields no evidence, and why a canary can read as passing while inert.
- ⛔**THIS STORE IS NOT YOURS.** ~10 of ~506 files are mine; ~79 are unattributed, **including the
  index itself**; a sibling's fabricated figure once steered a compaction here. ⇒ **a claim in your
  own memory files is not necessarily yours. There is NO line-level provenance — parse the
  `originSessionId` FRONTMATTER, never the wording.** ~4 sibling sessions rewrote `MEMORY.md` during a
  single exchange on 08-04, rejecting two of my edits mid-cycle ⇒ **prefer an atomic
  check-and-replace over read-then-write, and never quote a stored byte figure.**
- ⭐**Probe rules (the compressed set):** ENUMERATE, never count · assert SCOPE (window / depth /
  needle) **and** a NON-ZERO CONTROL · a probe that answers "no" to everything is not evidence · **a
  log listing can NEVER establish ancestry** · MEASURE YOUR OWN ENV, never inherit a peer's · a
  "don't re-litigate" tag claims **COVERAGE**, not confidence — the tell is whether it names an
  INSTRUMENT and a PATH · **when a query proves unreliable, re-run every claim that used it, PUBLIC
  ONES FIRST.**
- ⭐**Trim your OWN newest line first** — most growth in that header was commentary about the nag, not
  chain state. ⭐**Re-read the child before acting on a 🔴 row.**

## ⭐⭐⭐ 08-05 — THE CUT SEVERS MID-TOKEN: a truncated index yields a BROKEN LINK, not a missing row

> ⚠️**EVIDENCE BASE: slang#12345 chain, MEASURED ON TWO EDGES (peer's write went 54 B over its bound and
> truncated an archive sentence mid-word; mine severs a wikilink mid-path). Mechanical ⇒ trust the check.**

The bound is a **byte** cut, not a row cut. Measured on my index (89,387 B vs a 24,400 bound): the prefix
ends `...[A GUARD CAN BE INERT AND STILL READ AS PASSING](feedback_a_guard_can_b` — **a link truncated
mid-filename.** `feedback_a_guard_can_b.md` does not exist.

⇒ ⭐⭐⭐**A reader at the bound does not see a row vanish; they see a MALFORMED PATH that resolves to
nothing.** That is worse than absence in one specific way: absence prompts a search, a broken link reads as
a defect in the store and can be "cleaned up." **Never delete a link that looks broken without checking
whether it is simply the cut point.**
✅**Why this was harmless here, and it is the lifeboat design working, not luck:** the same rule carries a
**complete** reference in the header at line 3, so the severed copy at row 19 is redundant. Closure
re-run: 54 dark children, **0 orphans.** ⇒ **Redundant linking protects against mid-token severing too —
one more reason the remedy is ADD A PATH, never delete a row.**
⚠️**Peer's companion instance is the sharper one on instruments: the hook reported "23.2KB, approaching the
limit" while the file was already 54 bytes OVER.** A rounded total cannot express a 54-byte overshoot ⇒
**the nag's figure can say "approaching" while the state is "exceeded"; only the offset probe distinguishes
them.** Peer recovered by shortening **its own newest lines** — newest content pays.
⭐⭐**And the honest framing of any surviving headroom: peer measured 449 B and declined to call it "fine"** —
*measured, currently reachable, one write from failing again.* Both of us have now been wrong calling a
margin safe (641 B mine, 304 B theirs).

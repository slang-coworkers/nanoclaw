---
name: project_shared_learnings_duplicate_h1_generator_defect
description: "147 of 2030 shared-learning files carry a duplicate H1 (injected title + author restatement within 2 lines). Systemic append_learning defect, NOT a per-coworker slip. Cosmetic — do NOT mass-edit; fix host-side. Holds the FENCE-AWARE scan; a bare ^# count has 25 false positives."
metadata:
  node_type: project
  type: project
  originSessionId: main-2026-08-03
---

**Found 2026-08-03 16:3xZ while checking two newly-filed learnings for hygiene.**

## The defect

Many `/workspace/shared/learnings/*.md` files open with **two H1s within 2 lines** — the title line, then a near-identical restatement:

```markdown
# Correcting posture is the highest-risk posture — audit with more rigour than the original claim

# A verification done in order to correct someone needs MORE rigour than the original claim
```

**Scale: 147 files of 2030** (fence-aware, adjacency criterion; was 146 before one new filing). I had been repairing these one-batch-at-a-time all day (reviewer's `1785750665244` / `1785750713482`, babysitter's `1785774655133` / `1785774600509`) and telling coworkers it was "template composition on your side." **That attribution was wrong** — at 146 files across many authors and months (earliest `1778085879531`, Feb-dated prefixes through today) this is a **generator/template defect in `append_learning` or the wiki-fold pipeline**, not any coworker's editing habit.

## Scan command

⚠️ **A bare `grep -c "^# "` cannot distinguish an H1 from a `#` bash comment inside a fenced code
block.** Caught by `slang-pr-approver` 2026-08-03 16:41Z: the count on its own clean filing said 2, but
the second "H1" was a shell comment inside a ```` ``` ```` fence. *The check was wrong, not the file* —
had it trusted the count it would have "fixed" a non-problem.

**Main measured the blast radius, and the honest answer is narrower than it first looked:**

| criterion | naive | fence-aware | false positives |
|---|---|---|---|
| bare `count(^# ) > 1` | **174** | 149 | **25 (14%)** |
| **adjacency (2 H1s within 2 lines) — what this file's scan actually uses** | **147** | **147** | **0** |

So the fence bug is real and worth fixing in the tool, **but it never affected this file's numbers**: the
adjacency window (`h[1]-h[0] <= 2`) already excludes fence comments, which sit far below the title. The
146→147 drift is one new filing since. Slug one-sidedness re-verified on the corrected set: **147/147**
derive from the first H1, **0** from the second — the mechanism finding is untouched.

⚠️ **Do not over-generalize the correction either.** "25 false positives" applies to a bare `>1` count,
not to any count in this file. Verifying the fix meant re-running *both* criteria rather than assuming the
bug propagated everywhere the pattern appeared.

**⭐ A live POSITIVE CONTROL for this bug — keep it intact deliberately.** `1785773902337-cross-repo-gh-run-rerun…`
after repair has **real H1s = 1** but **naive `^# ` count = 2**. The phantom is
`# => {"status":"queued","conclusion":null,"attempt":2}`, a shell comment inside a ```` ```bash ```` fence at
**line 13** (I first published `:15` — wrong: that was the *pre-repair* offset, and removing the duplicate H1
shifted it up by two. **A line number cited across an edit needs re-deriving after the edit**, the same
commit-relative discipline as `file:line` in a PR).

Anyone running the bare count would "repair" a file that is already clean — and here the "fix" would **delete
a line of evidence from a code sample**. So this file now discriminates the two scan implementations in one
read: fence-aware says clean, naive says defective. That is an argument for **never** touching line 13
(approver's observation, 16:07Z). It is the positive control the scan lacked when I first wrote it — cf. the
standing rule that a zero-count check is only evidence if the same pattern returns non-zero on a case you know
exists.

**Use the fence-aware version regardless** (correct under both criteria, and safe if someone drops the
adjacency window):

```bash
cd /workspace/shared/learnings && python3 - <<'EOF'
import glob,io
for f in sorted(glob.glob("*.md")):
    fence=False; h=[]
    for i,l in enumerate(io.open(f,encoding="utf-8",errors="ignore").read().splitlines()):
        s=l.lstrip()
        if s.startswith("```") or s.startswith("~~~"): fence=not fence; continue
        if not fence and l.startswith("# "): h.append(i)
    if len(h)>=2 and h[1]-h[0]<=2: print("DUP:",f)
EOF
```

**Superseded (do not reuse for a bare count):** the earlier form counted `l.startswith("# ")` with no
fence tracking.

### ⚠️ SCOPE CORRECTION (Main, 16:5xZ) — the 25 false positives hit the UNCONSTRAINED form only; the figure I reported was never affected

Measured both criteria, naive vs fence-aware, side by side:

| criterion | naive | fence-aware | delta |
|---|---|---|---|
| **any** ≥2 H1s anywhere in file | 173 | 148 | **25** ← the FPs live here |
| **adjacency ≤2 lines** (what I actually ran and reported) | **147** | **147** | **0** |

**Delta zero on my criterion**, and the tier split is unchanged fence-aware: **exact 19 / near-J≥0.6 20 / differing 108** (= 39 at exact+near, matching the babysitter's 19 and 39 exactly). 146→147 drift is 4 files filed during the afternoon, not the fence bug.

**Why adjacency is immune:** a `#` bash comment inside a fence is essentially never within 2 lines of the title H1 — the fence opener, a prose lead-in, and the command sit between. The `≤2` window filters fence noise structurally, by accident rather than design.

⇒ **The approver's catch is real and the fence-aware scan is what to ship** (anyone reusing the query *without* the adjacency constraint gets 25 FPs). But **no number sent to the operator needs retracting** and no conclusion moves. Recorded precisely because *"your scan was wrong"* and *"your reported figure was wrong"* are different claims — conceding the second when only the first holds would be its own inaccuracy, the same over-correction reflex that produced my "you couldn't have prevented it." **Accepting a correction still requires checking its scope.**

⭐ **Lesson: a detection query is itself a claim that needs a discrimination test.** I built a scan to
find a formatting defect and never asked whether the scan could misfire, then used its counts as ground
truth across three reconciliation tables. The approver's instinct is the transferable part: *the check was
wrong, not the file* — when a count surprises you on a file you believe is clean, suspect the counter
first. Cf. [[feedback_name_what_you_held_fixed]].

**Second-order lesson from fixing it:** my first correction here asserted the 25 false positives applied
to this file's 146 — they don't. **A correction to a tool needs the same scoping discipline as a
correction to a claim:** re-measure which of your existing numbers the bug actually touched instead of
assuming it invalidates all of them. I nearly retracted a sound count on the strength of a real but
irrelevant bug.

## ⚠️ 17:11Z — "two positive controls" was WRONG, but so was the refutation. We audited DIFFERENT FILES.

I claimed *this* file (`project_shared_learnings_duplicate_h1_generator_defect.md`, my private memory note)
was a second positive control: bare count **2**, fence-aware **0**. The approver couldn't reproduce it —
reported bare **1**, fence-aware **1**, fences at 9/13/27/35 — and concluded my fence-aware checker was buggy
(`in_fence` initialized true, or counting inside fences), reasoning that **0 H1s is impossible** because
`append_learning` injects `# <title>` unconditionally.

**Both of us were partly right, and the disagreement was never about the checker. Re-derived:**

- **My numbers are correct for MY file.** Fence trace: fence opens **L16** (```` ```markdown ````), the two
  `# ` lines are **L17** and **L19** *inside* it, fence closes **L20**. Other fences 64/75, 121/126. So bare
  **2** / real **0** — both `# ` lines are the illustrative example of the defect, quoted inside a code block.
  No bug: the checker skipped exactly what it should skip.
- **Their numbers are correct for a DIFFERENT file** — the shared atom
  `1785774989369-append-learning-injects-the-title-as-h1-never-star.md`, whose fences are at **9/13/27/35**
  and which has its injected H1 at line 1. Their fence offsets identify it precisely.
- **Their invariant is real but scoped to the shared store — now MEASURED on both sides, not asserted:**

  | store | files | open `# ` | open `---` | other |
  |---|---|---|---|---|
  | `/workspace/shared/learnings/` | 2044 | **2016** | **0** | 28 |
  | my private `memory/` | 425 | **1** (`MEMORY.md`, no frontmatter by design) | **424** | 0 |

  Mirror images, cleanly separable by first line. So "no file here can have zero H1s" is **sound for the store
  it's scoped to and silently false one directory over**, because the generating mechanism differs:
  `append_learning` injects `# <title>`; my notes are OKF files that open with YAML frontmatter. Applying the
  shared-store invariant to a private OKF note is the category error underneath the whole exchange.

**⇒ The root cause is MINE, and it is not a code defect: I referred to "my dup-H1 note" and "its own file"
without naming a path.** The approver resolved the reference to the shared atom on the same topic — the only
sensible reading available to them — and then reasoned impeccably about the wrong file. **A filename is a
provenance claim: an unqualified "the file" is unverifiable when two stores hold a file about the same
subject.** Same axis as the `:15`/`:13` slip: relevant claim, wrong referent.

**So: one genuine positive control (`1785773902337`, phantom verified at line 13), not two.** This file
*behaves* like a second one, but only because it quotes the defect inside a fence — a property of the
illustration, not evidence about the detector.

**⭐ Kept because the approver's method was right even though its conclusion wasn't:** *"a checker whose output
violates a known invariant is broken regardless of what it reports"* is a genuinely cheaper test than a
line-by-line audit, and the correct response to it is to check whether the **invariant's scope** covers the
artifact — not to assume either the tool or the invariant is at fault. Two ways to be wrong here, and
"disagreeing numbers ⇒ someone's tool is broken" skips the third: **you are looking at different objects.**
Cf. [[feedback_unattributed_fact_reads_as_your_own]] (reader-relative references break across stores).

## 📁 Counting / rate post-mortems → split out

The three rate-and-recurrence post-mortems (measurement asymmetry, the three-way count reconciliation, and the
post-rule recurrence sweep) live in [[project_shared_learnings_h1_rate_postmortem]]. **Read that file before
citing any number about adoption or recurrence** — every rate in this chain was retracted at least once.

## ⚠️ Decision: do NOT mass-repair. Reasons, in order.

1. **It is cosmetic.** Both headings render; a reader loses nothing. No recall or link resolution depends on it (unlike the **dangling wikilinks** and **stale superseded claims** I *did* repair today — those actively misinform).
2. **A 146-file blind script edit is a large, hard-to-review write** for zero correctness gain, on a directory only I can write. If the de-dup heuristic is even slightly wrong it silently damages content in files nobody re-reads.
3. **Repairing instances leaves the generator producing more** — the two files I fixed at 16:3xZ were filed *minutes* earlier, i.e. the source is live.

⇒ Fixed only the two newest (already in hand), flagged the generator to the operator, and stopped. **This is the same discipline as standing down on the promised #12323 edit: a plausible-sounding cleanup is still an action that needs a reason beyond completeness.** Third instance today of catching an unnecessary bulk/outward write before making it.

## ⭐ MECHANISM DERIVED (reviewer, 16:36Z) — and it makes the defect AUTHOR-AVOIDABLE. My "you couldn't have prevented it" was WRONG.

`append_learning` writes `# <title>` as **line 0** and appends `content` beneath. **A second H1 appears only when the author starts `content` with `#`.** Fix at the write site: **start `content` with `##`, never `#`.**

**The reviewer's discriminator is the elegant part — and it's cheap.** The filename slug derives from the `title` argument, so compare the slug against each H1:

```
Main-reproduced: dup-H1 files 146 / 2026
  slug derives from FIRST H1 (= title arg): 146
  slug derives from SECOND H1 (= content):    0
  identical H1s: 16   differing: 130
```

**146/146 one-sided.** Had authors been duplicating their own headings, the split would be mixed. **Two framings ("generator's fault" vs "author-avoidable") predict different slug distributions, so one command told them apart** — same shape as the non-discriminating-signal rule, applied to an attribution question rather than a log claim.

## What I got wrong along the way

Told the reviewer and babysitter this was "template composition on your side" and asked them to drop the second H1. **Harmless but misattributed** — they can't fix a generator defect, and it framed a systemic issue as individual sloppiness. Corrected to both. **Rule: before telling a coworker their output has a defect, check whether the same defect appears across authors — if it does, it's infrastructure, and telling them to hand-fix it is asking them to paper over it.**

Related: [[feedback_correction_must_sweep_whole_file]] (the *opposite* call — that one had to be swept because stale prose actively misinforms), [[project_learnings_wiki_finalize_recount_recipe_stale]].

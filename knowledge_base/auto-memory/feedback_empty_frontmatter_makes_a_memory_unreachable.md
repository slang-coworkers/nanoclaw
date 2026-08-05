---
name: feedback_empty_frontmatter_makes_a_memory_unreachable
description: "Memory files with an empty name or NO description field are unreachable by relevance — including this chain's largest child and 2 of the 4 topic indexes just linked as tail-cut lifeboats, so half that mitigation was inert while recorded as done. No row dropped, no body byte lost, 0 broken links true — and irrelevant. Do NOT quote a count. My first detector had a false positive AND 2 false negatives: slice frontmatter at its terminator rather than a fixed line window, test missing-key and empty-value separately, and validate against synthetic controls plus a decoy whose body quotes the defect."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---
**Mine, 2026-08-04 17:0xZ, found while doing a position sweep for a retracted claim.**

## The finding

An index row of mine cited a fact as *"sitting in this very child's FRONTMATTER."* I opened the child
to check. Its frontmatter was:

```yaml
---
name: ""
metadata:
  node_type: memory
  originSessionId: 02f511c2-…
---
```

**No `description`. No `type`. An empty `name`.** This is `project_slangwin5_spirv_val_runner_defect.md`
— at 66 KB the largest and most-corrected child in the CI chain, holding two filed GitHub issues and
roughly a dozen retractions a reader must not restate.

Swept the whole store. **35 of 521 files flagged:** 9 with an empty `name: ""`, 26 with no
`description:` at all.

```bash
cd /home/node/.claude/projects/-workspace-agent/memory
grep -L '^description:' *.md          # missing description
grep -l '^name: *""' *.md             # empty slug
```

## ⭐⭐⭐ Why this is a distinct loss class

Every guard this store has accumulated watches for **deletion**: dropped index rows, truncated tails,
clobbered files, dead links. This defect trips none of them.

- **No row was dropped.** The index rows all pointed at real files.
- **No byte of body was lost.** Every file opened fine, fully intact.
- **The link check passes.** `0 broken links` was true and irrelevant.

And yet: `description` is the field recall reads to decide *whether to open a file at all*. With it
empty, a file is present, linked, well-formed — and **unreachable by relevance**. ⭐⭐⭐**Measure the
CONSEQUENCE (can a reader find this?), not the proxy (does the file exist / does the link resolve?).**
Same lesson the tail-cut analysis produced, arriving through a completely different mechanism, which
is why the existing guard didn't cover it.

⭐⭐**Nothing about the file LOOKED broken.** That is the family resemblance to
[[feedback_a_guard_can_be_inert_and_read_as_passing]]: from the reader's seat, a file with an empty
description is byte-identical to a healthy one until you read the frontmatter itself. Bodies are what
we open, so bodies are what we check.

## ⛔ The part that makes it urgent: my own mitigation was half-inert

Hours earlier I added four `[[…]]` "lifeboat" links high in `MEMORY.md`, above every plausible
truncation bound, so that a tail cut couldn't orphan the routing layer. That was the right fix. But
**2 of the 4 targets had `name: ""`** — `slang-ci-infra-chains-index` and
`slang-rhi-backend-chains-index`. If `[[…]]` resolves by the frontmatter slug rather than the filename,
**half my tail-cut mitigation never resolved**, and I had recorded it as done.

⭐⭐⭐**A mitigation is not verified until you check the mechanism it depends on, not just that you
performed it.** I verified the links were *present*; I never verified they were *resolvable*. Writing
the link and the link working are two claims, and I checked one.

## ✅ Fix applied

- Set `name:` to the filename slug on all 9 (a `[[slug]]` link now resolves under either rule —
  filename or frontmatter — so the lifeboats are no longer conditional on which convention holds).
- Repaired the big child's frontmatter with a full `description` + `type: project`, and left an
  in-file banner recording the defect.
- Delegated drafting the 26 missing descriptions to a read-only subagent (each must carry the
  issue number, the substance, the lifecycle state **only if the file states it**, and a ⛔ naming any
  retracted claim).

⚠️ **`type:` is still absent on many files** — lower stakes than `description` but worth a pass.

## ⛔⭐⭐⭐ MY FIRST DETECTOR WAS WRONG IN BOTH DIRECTIONS — and it "passed"

The detector I ran to find all this, and reported as clean, was `sed -n '1,20p' | grep`. **A fixed line
window is not the frontmatter.** Consequences, both real:

- **FALSE POSITIVE:** it flagged *this very file* — because line 19 of the body **quotes** `name: ""`
  as the example being documented. A detector that can't distinguish frontmatter from *prose about
  frontmatter* will always flag the lesson describing the defect.
- **FALSE NEGATIVES:** it missed `slang-evidence-lessons-instruments.md` and
  `slang-tick87-instrument-lessons.md`, which have **no `name:` key at all** (only `type`/`title`/
  `description`) — their frontmatter runs past 20 lines because `description` is long. Both are linked
  from `MEMORY.md`, so both were exactly the reachability hazard I was hunting.

⇒ ✅**Correct detector — slice at the terminator, never a line count:**
```python
s = open(f).read(); fm = s[3:s.find('\n---', 3)]      # frontmatter ONLY
re.search(r'^description:\s*\S', fm, re.M)            # present AND non-empty
m = re.search(r'^name:\s*(.*)$', fm, re.M)            # missing key != empty value
```
Both failure modes must be checked separately: **a missing key and an empty value are different
defects**, and my first pass tested only the second.

⭐⭐⭐**The recursion, again: the instrument built to find a class of defect had a defect of that
class.** I wrote a checker for "files whose metadata doesn't say what you think" using a method that
doesn't read what it thinks it reads. ⇒ **run a new detector against a synthetic positive control**
(a file you construct to be defective) so a clean sweep means "the detector fires and found nothing,"
not "the detector is silent." I added exactly that, and it's why the 2 misses surfaced.

⛔⭐⭐⭐**The babysitter took the recursion one level deeper than I did, and its framing is the one to
keep:** it had run my flawed detector over its own 69 files and got **clean** — *"and my clean result
under it looked like confirmation."* ⇒ ⭐⭐⭐**A PASSING CHECK FROM AN UNVALIDATED INSTRUMENT IS WORTH
LESS THAN NO CHECK, BECAUSE IT RETIRES THE QUESTION.** No check leaves a known gap that someone may
close; a false pass **converts an open question into a settled one**, and nothing downstream ever
re-opens it. That is the same asymmetry as [[feedback_a_guard_can_be_inert_and_read_as_passing]] and as
the unfalsifiability verdict in [[feedback_too_coarse_to_measure_is_a_claim_about_an_instrument]] —
**members of one class whose shared signature is that they consume the reason to look again — see [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] for the authoritative list.**

⇒ ✅**Its control set is better than mine and worth copying verbatim: FOUR controls — missing
`description`, empty `name` *value*, absent `name` *key* with a long description (reproducing my
20-line-window bug), and a DECOY whose *body* quotes `name: ""`.** All three defects fired; the decoy
correctly stayed silent. ⭐⭐**A control set that only contains positives can't catch a detector that
fires on everything — the decoy is what proves specificity**, and I had verified sensitivity only.
Re-running it, its 69 files are genuinely 0 issues; its earlier "clean" was uninformative.

⚠️**And the reported figure moved: 35 was my flawed detector's count.** The truth is 35 minus 1 false
positive plus 2 misses. **Do not quote 35** — re-run the scoped version. Final state after repair:
**526 files, 0 missing descriptions, 0 missing/empty names.**

## ⚠️ Provenance caveat

This store has ~4 sibling writers and no line-level provenance, so **I cannot attribute these to
anyone, including myself** — several `originSessionId` values are not mine. The count is also
**per-moment**: siblings add files continuously, so re-run the sweep rather than trusting 35.

⭐**Standing habit this earns: when you open a large child, read its frontmatter, not just the section
you came for.** The one I opened had been cited by an index row as *containing* a fact — which means
somebody (me) had read past the empty frontmatter at least once already.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[feedback_compaction_target_yields_to_load_bearing_content]] ·
[[dark_open_chains_restored]] · [[feedback_correction_unapplied_until_every_restatement_fixed]]

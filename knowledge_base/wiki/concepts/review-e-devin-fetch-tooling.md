---
title: "Devin/review harness tooling — the false-clean scraper defect family"
type: concept
group: review
tags: [devin, devin-fetch, pr-review, infra-abstain, false-clean, scraper, tooling]
source_count: 19
---

## TL;DR

`devin-fetch.sh` (the scraper that turns a Devin Review page into `devin-flags.md`)
has a whole family of defects that all present the same way: **exit 0 with an empty
`## Flags` section, which reads as "Devin found nothing" — a false-clean biased
toward approval.** A reviewer's clean bill and an instrument that never read the
reviewer produce *byte-identical artifacts*; only opening the page distinguishes
them. The distinct defects, all confirmed:

- **Byte-count integrity guard** (`DEVIN_MIN_BYTES:-200`) measures size, not
  content — the artifact concatenates the whole page (nav, diff hunks), so a
  zero-finding scrape is still multi-KB and passes.
- **Done-guard accepts CI-panel terms** (`Checks N/M`, `All checks passed`) as a
  stand-in for a review verdict; a page whose findings never rendered (behind an
  unclicked `View results`) exits 0.
- **`heading` term is vacuous** — `Devin's AI analysis` is a static tab-label
  present on 177/177 / 125/125 pages, so `heading && summary` collapses to
  `summary`. A conjunction whose left term is never false is not a conjunction.
- **HEADER_RE newline overlap** — `finditer` is non-overlapping and each header
  consumes a `\n` on both ends, so of any two *adjacent* toggles the second is
  never matched. In a run of N adjacent headers, every other one drops. The zero-
  sentinel then overwrites the swallowed body with `(none reported)`, making the
  loss *silent* (a non-zero count corrupts *visibly* instead). Only a **content**
  line between toggles recovers it — a blank line does not.
- **JSON-escaped page dumps** — `agent-browser eval 'document.body.innerText'`
  emits a JSON-quoted single-line string; undecoded, every newline-anchored regex
  matches nothing. **Copy-scoped**: the slang copy decodes; the nanoclaw copy did
  not.
- **`Generating…` guard greps the truncated extract**, not the page dump, so a
  still-generating marker past char 5000 escapes.
- **Exit gate is not token-gated** — even after the poll-predicate fix
  (nanoclaw#1145) shipped, a padded token-less body still hits an implicit exit 0.

The one durable detector that beats all of them: **reconcile the page's own
advertised `N Bugs`/`N Flags` count against the finding bodies actually emitted,
and hard-fail on `advertised > captured`; absent-advertised ⇒ inconclusive, never
clean.** A size guard tests "did we scrape something"; a marker guard tests "did we
see a panel"; only reconciliation tests "did the extractor keep what the panel
held." Always cross-check `devin-page.txt` (free, on disk) before folding a Devin
zero into a verdict.

## The false-clean shape and why it survived months

An empty findings section plus exit 0 is indistinguishable from a genuine clean
review — that is the core of the class. The failure is *silent* and *permissive*:
empty flags reads as "Devin found nothing," which corroborates approval, and nothing
downstream flags it. Attributing the failure to Devin ("empty Flags") rather than to
the scraper ("my instrument never read the reviewer") is itself the recurring error;
the two produce the same bytes and only opening the page tells them apart.

A standing rule underlies the whole family: **empty findings + exit 0 = false clean
⇒ demand a positive verdict token.** That rule had been proven on *harvested bot
reviews* but never carried to *Devin* — "a rule proven on one instrument is owed to
every instrument of the same shape." The class recurred for ~3 months across 12+ learning atoms, 6 of them written after
the last commit to touch the file — the knowledge was re-derived and re-filed as
lessons while the artifact sat unpatched. **The Nth atom about one defect is the
signal to write a diff, not an (N+1)th atom**
[[approver/infra-abstain] CORRECTION to my devin-fetch line refs (:104/:109 not :105/:110) — and the fix shipped in nanoclaw#1145](wiki/learnings/1786121711724-approver-infra-abstain-correction-to-my-devin-fetc.md).

## The distinct defects, enumerated

**Byte-count guard.** The 200-byte floor is not an integrity check when the body is
padded with the echoed-back PR description and diff hunks — a sentinel-only extract
can measure 224B, a padded token-less body ~5KB, both passing
[[approver/infra-abstain] devin-fetch.sh exits 0 with an EMPTY Flags section — byte-count integrity guard is not a content guard](wiki/learnings/1786111891962-approver-infra-abstain-devin-fetch-sh-exits-0-with.md).

**Done-guard / CI-panel substitution.** `summary` accepted `Checks N/M` /
`All checks passed` — GitHub CI state, orthogonal to whether Devin's analysis
rendered. A near-miss substitution (a token from a *different subsystem* accepted for
the one needed) is the tell; any predicate whose accept-set spans two subsystems
deserves a look
[[approver/infra-abstain] devin-fetch.sh can exit 0 with a false-clean empty Flags section (checks panel satisfies done-guard)](wiki/learnings/1786117609038-approver-infra-abstain-devin-fetch-sh-can-exit-0-w.md)
[[approver/infra-abstain] devin-fetch.sh done-guard accepts the CI-checks panel as a verdict — false-clean, biased permissive (both skill copies)](wiki/learnings/1786118665219-approver-infra-abstain-devin-fetch-sh-done-guard-a.md).
`View results` present in the page dump means the panel was never expanded — a
diagnostic hint, but not a full detector (6 of 22 no-token pages lack it, and the
UI strings move)
[[approver/infra-abstain] devin-fetch.sh done-guard accepts the CI-checks panel as a review verdict — exit 0 on an unread review](wiki/learnings/1786119011784-approver-infra-abstain-devin-fetch-sh-done-guard-a.md).
The `heading` conjunct is vacuous chrome; demand a *positive* token instead, and
require two separate tokens — a liveness token (it fetched *this* head) and a
findings token — since "it retrieved the PR" is independent of "it reviewed it."

**HEADER_RE adjacency drop.** The mechanism is a run-length pattern, not "the second
one" — in a run of N adjacent headers every other drops, starting at position 2
[[approver/challenger-miss] A regex whose terminator is also its neighbour's prefix drops every other match in a run — why sampling kept clearing devin-fetch.sh](wiki/learnings/1786118382069-approver-challenger-miss-a-regex-whose-terminator-.md).
The drop is *unconditional on the count*; the zero-form bugs header (`0 Bugs` /
`No bugs`) only makes it *silent* by triggering the zero-sentinel overwrite, while a
non-zero count corrupts visibly. This was corrected twice: an initial "zero-count is
load-bearing" conjunct was wrong, refuted by execution
[[approver/infra-abstain] devin-fetch.sh drops a rendered flag: adjacent Bugs/Flags headers share one newline, so HEADER_RE never matches the second — 56 of 176 local artifacts affected](wiki/learnings/1786114247716-approver-infra-abstain-devin-fetch-sh-drops-a-rend.md)
[[approver/critique-mustfix] Correction to my devin-fetch.sh HEADER_RE atom: the destroying conjunct is a ZERO-FORM bugs header, and only ONE of my two copies has HEADER_RE at all](wiki/learnings/1786114995303-approver-critique-mustfix-correction-to-my-devin-f.md)
[[approver/challenger-miss] HEADER_RE adjacency drop is unconditional on the count, not zero-gated](wiki/learnings/1786115590956-approver-challenger-miss-header-re-adjacency-drop-.md)
[CORRECTION — the Devin HEADER_RE drop is unconditional; my zero-count conjunct was wrong](wiki/learnings/1786115910981-correction-the-devin-header-re-drop-is-uncondition.md).
Recovery needs a *content* line between toggles — a blank line supplies no extra
`\n` — which is why sampling repeatedly cleared the defect: the visible symptom
depends on page *shape*, so N clean samples of one shape is one sample. Fix is a
non-consuming lookahead (`\s*\n` → `\s*(?=\n)`).

**JSON escaping.** Copy-scoped, not family-wide: the slang copy pipes through
`json.loads` before writing; the nanoclaw copy wrote raw. An escaped `devin-page.txt`
*on disk proves which extractor ran* (mtime cannot — both share install mtime). A
`wc -l` of 1 is the tell. Count reconciliation also fails on escaped text (`\b(\d+)`
can't match `\n0` where the literal `n` fuses with the digit), so unescape *before*
adding any gate or it passes vacuously
[[approver/clause-gap] Devin page dumps are JSON-escaped — extractor silently reports zero findings](wiki/learnings/1786115585707-approver-clause-gap-devin-page-dumps-are-json-esca.md)
[[approver/infra-abstain] devin-fetch.sh page-dump decode is copy-scoped; an escaped dump on disk proves which extractor ran](wiki/learnings/1786117419523-approver-infra-abstain-devin-fetch-sh-page-dump-de.md).
Keep the deliberate asymmetry: the page-decode is unguarded under `set -euo
pipefail` so a truncated scrape fails loudly rather than falling through to the byte
floor — adding `|| true` there would re-introduce the false-clean.

**Generating guard.** It greps `devin-flags.md` (the truncated `[:5000]` extract),
not `devin-page.txt`, so a marker past the cap escapes. A guard must read the
artifact whose property it claims to test
[[approver/infra-abstain] devin-fetch.sh's Generating guard greps the TRUNCATED extract instead of the page dump — a 5th defect; plus my edge's category split (17/176 no-flags-header, all passed)](wiki/learnings/1786115361744-approver-infra-abstain-devin-fetch-sh-s-generating.md).

**Exit gate.** nanoclaw#1145 fixed the *poll predicate* (settled-rail requirement +
`View results` click + a test that extracts the live `DONE_EXPR` from the `.sh` so it
can't drift), *not* the *exit gate*: no `exit` is token-gated, verified by execution
on both copies (padded token-less body ⇒ both guards PASS ⇒ implicit exit 0). A ✅
"FIXED" headline on a partial fix — with the caveat living in a different file from
the headline — is worse than no note, because the index reader takes it as "class
retired." Run the gate; a structural read is a hypothesis about behavior
[[approver/critique-mustfix] A partial fix logged with a ✅ headline is worse than no note — and the exit gate still false-cleans (execution-verified)](wiki/learnings/1786125137805-approver-critique-mustfix-a-partial-fix-logged-wit.md).

## Staleness — which commit did Devin actually analyze?

Devin re-analyzes asynchronously after a push; between push and re-analysis the page
serves the previous revision's analysis, with nothing marking it stale. Devin never
prints full head SHAs, so grepping the head yields 0 hits either way and proves
nothing. Working discriminators: the rendered `Subproject commit <sha>` gitlink hunk
(compare to `gh api .../contents/<submodule>?ref=<head>`), the `Commits<N>` sidebar
label, or a SHA in Devin's own analysis bullets. File/line counts *cannot*
discriminate — a pure gitlink bump renders identically. There is no re-run control in
the UI; the only remedy for a stale page is to wait and re-fetch
[Devin Review staleness: discriminate the analyzed commit via the rendered gitlink, not file/line counts](wiki/learnings/1786115970876-devin-review-staleness-discriminate-the-analyzed-c.md).

## Identity, copies, and ownership

Two files with the same name are not the same code — before asserting a defect in
copy N+1, grep for the *specific construct* in that file. The copies diverge silently
(187 vs 218 vs 223 vs 331/360 lines) and their fix lists differ per-copy. **Identify a
file by blob sha or a named-token count, never a line total** — a line total drifts
with hand-ported comments and goes stale in the very PR announcing it. What settled a
218-vs-223 dispute in one step was matching *shape invariants* (`grep -c
checksSettled` → 2, `grep -c 'View results'` → 3 on both edges)
[[approver/infra-abstain] Identify a file by blob sha or a named-token count, never a line total — and audit whether a guard's left term is ever false](wiki/learnings/1786124455206-approver-infra-abstain-identify-a-file-by-blob-sha.md).
Edit survival matters: `slang-pr-review-runner` and `*-pr-approver` are synced from
`shader-slang/slang-skills` (in-place edits revert with no signal ⇒ durable route is
a PR upstream); the nanoclaw copy is local and safe to edit. Check
`.external-skills.json` before promising a fix propagates.

## Position a fix at the last gate, and beware the PR that fixes your own instrument

When the causal story is contested, prefer the gate closest to the decision: **a fix
positioned at the last gate before `exit 0` survives a wrong mechanism; a fix
positioned at an entry condition does not.** Two tiers each built a causal story from
the artifacts they held and both stories were wrong, yet a verdict-token gate at the
exit survives regardless of which degraded path fired (`No analysis available` is the
one degraded mode whose page self-reports emptiness — add it as an explicit token).
Every absence report inherits the scope of the search that produced it (`find
/workspace` on the wrong root, "177/177" meaning *archived ⇒ scraped* not the timeout
population) — state the search scope inside the claim
[[approver/infra-abstain] CORRECTION + supersedes: devin-fetch.sh false-clean — fix at the exit-0 gate; the causal story I filed earlier was wrong](wiki/learnings/1786119647751-approver-infra-abstain-correction-supersedes-devin.md).

The sharpest COI: **a PR that fixes your own instrument is the one you can least
review** — the only review signal available would be produced *by the instrument under
decision*, so running Devin on a Devin-scraper fix is circular. A candid author report
(self-correcting its own figures, disclosing residual defects) raises trust in the
*reporter* without making the claims *independent*; a report this rigorous *reads* like
a review but is still author's evidence. Adjudicate none of the author's merits claims,
stamp `bugs/gaps = 0` as NOT ASSESSED (never "clean"), and carry forward only what you
measured yourself
[[approver/challenger-miss] A candid author report is still author's evidence — and the PR fixing your instrument is the one you can least review](wiki/learnings/1786123908683-approver-challenger-miss-a-candid-author-report-is.md).

## The gate hook that blocks read-only verification

`gate-critique-on-deliver.sh` matches the *URL path* `.../pulls` with no HTTP-method
discrimination, so read-only `gh api .../pulls` GETs — exactly the verification an
approver needs — trip a PR-**creation** gate; the denial cap is container-shared and
escalates to an admin bypass. The tempting fix ("no `--method` ⇒ GET ⇒ allow") **fails
open**, because `gh api` defaults to POST when any `-f`/`-F` payload flag is present,
so a real `gh api .../pulls -f title=…` would sail through. The correct predicate
blocks on explicit write method *or* payload flags, with `-X GET` outranking payload
presence (gh's own read-only idiom). A proposed *fix* gets the same adversarial probe
as a finding: verify both directions. Note the truth table in the original atom was
labeled "must satisfy" — spec language that reads as verified beside executed facts;
it was **reasoned, not executed**, and untestable by exercise because any shell table
of sample commands trips the matcher itself
[[approver/infra-abstain] gate-critique-on-deliver.sh blocks read-only gh api pulls GETs — and the obvious fix fails open, because gh api defaults to POST](wiki/learnings/1786117698627-approver-infra-abstain-gate-critique-on-deliver-sh.md)
[[approver/critique-mustfix] Correction: the hook predicate in my prior learning is REASONED, NOT EXECUTED — and untestable by exercise](wiki/learnings/1786117922899-approver-critique-mustfix-correction-the-hook-pred.md).

## Cross-references

The correction/measurement discipline these tooling atoms exercised — pagination,
correction-as-diligence-slot, provenance, predicate-splitting — lives in the
self-correction pages ([[wiki/concepts/review-e-self-correction.md]],
[[wiki/concepts/review-e-self-correction-2.md]]). The abstain-severity calls the
scraper feeds into live in [[wiki/concepts/review-e-abstain-calibration.md]].

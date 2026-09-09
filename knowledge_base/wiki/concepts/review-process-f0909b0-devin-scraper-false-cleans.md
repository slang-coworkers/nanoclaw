---
title: Devin scraper false-cleans — empty "## Flags" is UNEXTRACTED, not clean
type: concept
group: review-process
tags: [devin-fetch, false-clean, extraction-defect, positive-token, json-escape, approver, agent-browser]
source_count: 13
---

## TL;DR

`devin-fetch.sh` (the browser scraper the PR-approver uses for Devin's review) is
a serial false-clean generator: it repeatedly **exits 0 with an empty `## Flags`
section while the raw page actually carried findings**. Read at face value this
looks like "Devin ran, found nothing" — the safest-looking input — while it is
in fact the most dangerous, because it degrades silently toward APPROVE and drops
the highest-severity finding.

The single durable rule across every instance: **an empty findings section plus
exit 0 is UNEXTRACTED, never clean. Demand a POSITIVE count token — a literal
`N Bugs` / `M Flags` present in the raw capture (`devin-page.txt`), not the
derived `devin-flags.md`.** A `(none reported)` default that renders as `0` is an
*unfalsifiable* clean — nothing distinguishes "reviewed, found nothing" from
"never ran / extractor dropped it".

Recurring mechanisms behind the empty section:

- **JSON-escaped newlines.** `agent-browser eval 'document.body.innerText'`
  returns the whole page as ONE line with literal `\n` two-char escapes. The
  extractor's `re.split(r'\n\s*\d+\s*Flags?\s*\n', …)` needs real newlines, so it
  never fires; everything falls into `## AI Analysis` and `## Flags` is empty. Fix:
  `text.replace('\\n','\n')` (or `json.loads`) BEFORE splitting.
- **Positional single-split.** Bugs render before the `0 Flags` counter, so a
  Bugs section falls into the narrative bucket; parse each section by its own
  heading, not one positional split.
- **`analysis[:5000]` truncation** cuts the verdict panel (it can sit at char
  34443) out of the file entirely.
- **Bad done-signal.** A `Checks N/M` match is GitHub's right-rail CI counter,
  present on every page — so the "analysis complete" predicate reduces to
  `heading && true` and scrapes an unexpanded/still-generating panel.
- **Unclicked "View results".** Findings sit behind a control the script never
  clicks.

Discriminator when `## Flags` is empty: `grep -c 'Flag' devin-page.txt` — **0 =
early scrape (nothing to recover)**, **≥1 = parse defect (findings on disk,
recover them)**. Also `wc -l devin-page.txt == 1` is the escaped-newline
signature. Two forks of the script exist and neither is a strict superset; the
fix you rely on may not be in the copy you run, and any fix is not version-
controlled so a container rebuild reverts it.

## The core failure and its invariant

Every atom in this cluster is one shape: **`devin-fetch.sh` exits 0, writes a
byte-healthy `devin-flags.md`, and the `## Flags` section is empty while Devin
actually found things.** The body-integrity guards never fire because the whole
PR description gets swallowed into `## AI Analysis`, inflating the file well past
`DEVIN_MIN_BYTES=200` with no `Generating…` sentinel. A size guard measures
presence of *bytes*, not presence of *findings*.

The invariant distilled repeatedly: **demand a POSITIVE token**. The earliest
statement of it — on slang-rhi#822 — names the trap precisely: `(none reported)`
is the Python `.get()` **default for a section header that was never found**,
byte-identical to a genuine zero, so "an empty section plus exit 0 is an
*unfalsifiable* clean; verify the token in the raw artifact, not the summarizer's
output" [Devin false-clean: not-found default renders as 0](../learnings/1786368481518-approver-infra-abstain-devin-false-clean-a-not-fou.md).
The same maxim recurs verbatim on slang#12448 (empty `## Flags` = **UNEXTRACTED,
not clean**, and byte-size/sentinel guards *cannot* detect it because unrelated
text pads the file) [empty Flags is unextracted](../learnings/1786377378749-approver-infra-abstain-devin-fetch-sh-exits-0-with.md),
and again as the transferable rule that "absence of findings in a derived
artifact is evidence about the *deriver*, never about the code" [empty Flags when the page reports Bugs](../learnings/1786382243960-approver-infra-abstain-devin-fetch-sh-writes-an-em.md).
The false-clean is the *dangerous direction* — it hides findings rather than
inventing them, so the instrument degrades toward approval, which is exactly why
the scrutiny an approver aims at a PR's evidence is owed to its own tools
[empty Flags on a FLAGGED review](../learnings/1786386045220-approver-infra-abstain-devin-fetch-sh-emits-an-emp.md).

## Root mechanisms behind the empty section

**JSON-escaped newlines (the most common cause).** `agent-browser eval
'document.body.innerText'` returns the dump JSON-quoted as a single physical
line — measured as "1 real newline vs 1291 literal backslash-n" on slang#12448
[empty Flags — newline-escape mismatch](../learnings/1786376659246-devin-fetch-sh-emits-an-empty-flags-section-with-e.md),
"1 vs 311" on slang-rhi#826 [empty Flags, innerText JSON-escaped](../learnings/1786386045220-approver-infra-abstain-devin-fetch-sh-emits-an-emp.md),
and `wc -l == 1` on slang-rhi#598 [empty Flags is a scrape-format artifact](../learnings/1786432165046-devin-fetch-sh-empty-flags-section-can-be-a-scrape.md).
The extractor at `devin-fetch.sh:188` splits on a **real**-newline regex
(`re.split(r'\n\s*\d+\s*Flags?\s*\n', …)`), which can never match, so `flags=''`
and the entire page becomes `## AI Analysis`. The durable fix is to normalize
`\\n` → `\n` (or `json.loads()` when the payload starts with `"`) before
splitting. slang#12467 sharpens the prescription: because the dump is one line,
the extractor should **key on the counter substring, not a multiline split**
[extractor drops the flag count](../learnings/1786495242058-approver-critique-mustfix-devin-fetch-extractor-dr.md).

**A latent-vs-active refinement.** One note establishes that on *its* artifact
the word "flag" occurred zero times in the scrape (the page was early, so no
decode could recover anything) and filed the missing `json.loads` as a "latent
second bug". slang-rhi#827 is the instance where that latent bug is the **active
and sole cause**: `1 Bug` (an ABI/source-compat break on `include/slang-rhi.h`)
plus a Flag were verbatim in `devin-page.txt` and the decode gap dropped them.
The reconciling discriminator — **one grep before believing any empty Flags** — is
`grep -c 'Flag' devin-page.txt`: 0 hits ⇒ early scrape (no recovery), ≥1 hit ⇒
parse defect (recover with `.replace('\\n','\n')`) [the json.loads decode gap is the active cause](../learnings/1786441068624-approver-infra-abstain-devin-fetch-sh-empty-flags-.md).

**Truncation and positional split.** `analysis[:5000]` truncates while the
verdict panel sits at char 34443, so `0 Bugs / 1 Flag` and all seven findings fall
outside the cap [empty Flags — newline-escape mismatch](../learnings/1786376659246-devin-fetch-sh-emits-an-empty-flags-section-with-e.md).
Independently, Devin renders the Bugs list *before* the `0 Flags` counter, so on a
`2 Bugs / 0 Flags` page the entire Bugs section falls into the narrative bucket
and the Flags tail is correctly empty — "`Flags: 0` and `Bugs: 2` are different
assertions; never fold Devin's verdict off the Flags section alone"
[a Flags-only read is a false clean](../learnings/1786382243960-approver-infra-abstain-devin-fetch-sh-writes-an-em.md).
The extractor also greps for a flag-list *shape* Devin does not always render
(findings can be inline in the review body), so exit 0 means "the fetch
succeeded", not "the findings were extracted"; the fix should stamp the resolved
head SHA into `devin-flags.md` and fall back to scraping finding-shaped lines
[empty Flags while findings sit in the page dump](../learnings/1786399891178-approver-infra-abstain-devin-fetch-sh-can-exit-0-w.md).
On slang-rhi#831 the extractor recognized Bugs/Informational but **mis-parsed the
Flags section** (rendered as `title / Investigate / file:line` triplets), emitting
"none reported" while the counter line said "6 Flags" — "void/failed extraction
returns to UNKNOWN, not to clean" [extractor silently drops Flags — 0 vs 6](../learnings/1786488777764-approver-infra-abstain-devin-fetch-extractor-silen.md).

**Bad done-signal — the reverted fix.** On slang#12465 a fix recorded as applied
five days earlier was **gone from the live script** and the failure shipped again.
The done-check accepted `/Checks\s*\d+\s*\/\s*\d+/`, which matches GitHub's CI
right-rail counter (`gh pr checks 12465 | wc -l` == 49, matching "Checks 49/49")
present on every page — so the predicate reduced to `heading && true`, findings sat
behind an unclicked "View results", and after repair the same PR yielded `1 Bug +
2 Flags + 2 Informational`. The rules: **a memory saying "fixed" is a claim about
the past, not live state — grep the script**; **every done-check pattern must be
specific to the artifact carrying the property, never ambient page furniture**;
and **prove the fix in both directions** (a synthetic `3 Bugs` must pass, a
synthetic `No bugs` must not be rejected) [Devin false-all-clear regressed](../learnings/1786405505888-devin-false-all-clear-regressed-verify-the-fix-is-.md).

## Two forks, an exit-127 quoting bug, and durability

**Neither script variant is a strict upgrade.** On slang-rhi#824 both variants'
failure modes fired in one session: the **nanoclaw** variant had the broken
artifact parse (no `json.loads`, empty Flags) but the correct done-signal
(`passed === total`); the **slang** variant had the `json.loads` decode fix but a
broken done-signal that would accept a partial `Checks 21/22` mid-generation. If
you copy one over the other you import a false clean — "when two forks of one tool
exist, assume each is newer in a different half; diff the halves you depend on"
[two devin-fetch variants, each newer in a different half](../learnings/1786372259773-devin-fetch-sh-the-nanoclaw-and-slang-variants-are.md).
A "Connect GitHub" / "Sign in" string in the scrape is navbar chrome, **not** proof
of an auth wall — confirm access from rendered PR content instead.

**The self-referential exit-127 bug.** The slang copy died exit 127 within seconds
because a comment line inside the single-quoted `DONE_EXPR` contained apostrophes
(`grep -ci 'view results'`) that **closed the shell string early**; bash then ran
the JS remainder as a command. `bash -n` does **not** catch it — the quotes still
balance, so it is a *quoting* bug, not a syntax error, visible only at run time.
Two durable rules: **treat any exit code outside {0,2,3,4} as a harness defect, not
a Devin skip** (127 → a caller matching only documented codes reads it as
`DEVIN_SKIPPED` → a manufactured `NO_REVIEW_SIGNAL` on a Devin-only PR); and this
file is **not version-controlled, so a container rebuild reverts the fix** — re-scan
after every rebuild [exit 127: apostrophes closed the single-quoted DONE_EXPR](../learnings/1786446800096-approver-infra-abstain-devin-fetch-sh-slang-copy-d.md).

## Recovery recipe (mechanical, no re-run)

When `## Flags` is empty: (1) `wc -l devin-page.txt` — a count of 1 means escaped-
newline scrape; (2) `grep -oiE "[0-9]+ (bug|flag)s?|No flags" devin-page.txt` — a
positive counter present means findings exist regardless of section placement;
(3) unescape `\\n` → `\n`, then slice from the verdict index to the `Checks` panel
(findings are `title / severity / file:line` triplets); (4) keep the raw page as
the source of record — when `devin-flags.md` and `devin-page.txt` disagree, the
page wins. Note `Loading diffs… This may take a few moments for large PRs` can
appear even at a completed verdict, so it is **not** a reliable still-streaming
signal [empty Flags is a scrape-format artifact](../learnings/1786432165046-devin-fetch-sh-empty-flags-section-can-be-a-scrape.md);
and `devin-error.txt` is written only on failure and **not cleared on a later
success**, so a stale error file alongside fresh artifacts is expected — date
artifacts by mtime [empty Flags on a FLAGGED review](../learnings/1786386045220-approver-infra-abstain-devin-fetch-sh-emits-an-emp.md).

The first atom also carries a companion instrument defect on a different channel:
`record_decision` returned "Decision recorded" while the host separately denied the
write (`APPROVAL_LEDGER_WRITERS` unset), so **a tool's own success string is not
evidence its write landed — when two channels disagree about your own side effect,
the channel you did not author wins** [Devin false-clean plus record_decision success-string](../learnings/1786368481518-approver-infra-abstain-devin-false-clean-a-not-fou.md).
That defect is developed further in the decision-artifact-hygiene page.

**Source learnings (13):**

- [Devin false-clean: a not-found default that renders as "0" is unfalsifiable; plus record_decision success on a denied write](../learnings/1786368481518-approver-infra-abstain-devin-false-clean-a-not-fou.md) — `(none reported)` is a `.get()` default byte-identical to genuine zero; done-signal needs a positive token; findings hide behind unclicked "View results".
- [Two devin-fetch.sh variants, each newer in a DIFFERENT half](../learnings/1786372259773-devin-fetch-sh-the-nanoclaw-and-slang-variants-are.md) — nanoclaw has the `passed===total` done-signal, slang has the `json.loads` decode; neither is a superset, copying either imports a false clean.
- [empty Flags with exit 0 — newline-escape mismatch](../learnings/1786376659246-devin-fetch-sh-emits-an-empty-flags-section-with-e.md) — innerText JSON-quoted as one line (1 real newline vs 1291 literal); split never matches, `analysis[:5000]` cuts the verdict at char 34443.
- [empty Flags = UNEXTRACTED, not clean](../learnings/1786377378749-approver-infra-abstain-devin-fetch-sh-exits-0-with.md) — slang#12448 dropped a lone `Investigate` flag; byte-size and sentinel guards cannot detect it since the PR description pads the file.
- [empty Flags when the page reports Bugs — a Flags-only read is a false clean](../learnings/1786382243960-approver-infra-abstain-devin-fetch-sh-writes-an-em.md) — Bugs render before the `0 Flags` counter and fall into the narrative bucket; `Flags:0` and `Bugs:2` are different assertions.
- [empty Flags on a FLAGGED review — innerText JSON-escaped](../learnings/1786386045220-approver-infra-abstain-devin-fetch-sh-emits-an-emp.md) — slang-rhi#826; the page wins over the derived file; `devin-error.txt` is not cleared on a later success.
- [exit 0 with empty ## Flags while findings sit in the page dump](../learnings/1786399891178-approver-infra-abstain-devin-fetch-sh-can-exit-0-w.md) — slangpy#1098; extractor greps for a flag-list shape not always rendered; stamp the resolved head SHA into the file.
- [Devin false-all-clear regressed — verify the fix is IN the script](../learnings/1786405505888-devin-false-all-clear-regressed-verify-the-fix-is-.md) — `Checks 49/49` matched CI furniture; done-checks must be artifact-specific; prove the guard in both directions; DONE_EXPR quoting hazard.
- [empty ## Flags can be a SCRAPE-FORMAT artifact, not absence of flags](../learnings/1786432165046-devin-fetch-sh-empty-flags-section-can-be-a-scrape.md) — slang-rhi#598; `wc -l == 1` detector; `Loading diffs…` is NOT a reliable still-streaming signal.
- [empty ## Flags: the json.loads decode gap is the ACTIVE and sole cause](../learnings/1786441068624-approver-infra-abstain-devin-fetch-sh-empty-flags-.md) — slang-rhi#827; `grep -c 'Flag' devin-page.txt` discriminates early scrape (0) from parse defect (≥1); dropped an ABI/source-compat Bug.
- [devin-fetch.sh (slang copy) died exit 127 — apostrophes closed the single-quoted DONE_EXPR](../learnings/1786446800096-approver-infra-abstain-devin-fetch-sh-slang-copy-d.md) — `bash -n` misses a quoting bug; any exit outside {0,2,3,4} is a harness defect; the file is not version-controlled and reverts on rebuild.
- [extractor silently drops Flags — devin-flags.md said 0 while the raw page had 6](../learnings/1786488777764-approver-infra-abstain-devin-fetch-extractor-silen.md) — slang-rhi#831 R5; Flags render as `title/Investigate/file:line` triplets the parser mis-handles; failed extraction returns to UNKNOWN, not clean.
- [extractor drops the flag count; empty ## Flags ≠ zero flags](../learnings/1786495242058-approver-critique-mustfix-devin-fetch-extractor-dr.md) — slang#12467; the dump is one escaped line so key on the counter substring not a multiline split; cross-check captured-count == rail-count before parsing the verdict.

---
title: Review instruments — Devin harness, GitHub CLI traps, and reviewer-artifact recovery
type: concept
group: review
tags: [approver, infra-abstain, devin, gh-cli, controls, reviewer-runner, false-clean, formatting]
source_count: 27
---

## TL;DR

Every instrument in the review harness has a failure mode that **returns a well-formed success while
unable to represent the answer** — no error, no non-zero exit, and the wrong answer almost always
points toward "nothing here," the direction that closes an investigation and gets the least scrutiny.

- **The Devin scraper (`devin-fetch.sh`) exits 0 on a false-clean in at least four distinct ways**:
  the analysis pane half-renders, `agent-browser eval` returns JSON-quoted single-line text so the
  newline-anchored Flags splitter never matches, the done-check matches GitHub's rail `Checks N/M`
  counter instead of a findings summary, and it scrapes the PR description instead of the analysis.
  A size guard cannot detect wrong content. **Demand a positive token** (`N Bugs / M Flags`), never
  infer "clean" from absence; on a Devin-only tier a false-clean silently discards real findings.
- **The one defence that works on all of them: pair every zero with a control that MUST fire.** Then
  ask "could this have come out otherwise?" — a check green *by construction* carries zero bits.
- **GitHub/CLI instruments lie by silence too**: substring filters over a job matrix pick the wrong
  object, `--paginate` splices an error into a partial array, the contents API returns empty for
  >1MB files, GraphQL drops the `[bot]` login suffix, `search/code` can be unindexed, `git log -S`
  on a shallow clone names a false positive, `grep -c` counts lines not occurrences.
- **A reviewer's output file is not its review.** Reviewer A/C write only the *last* assistant text
  block; a stalled reviewer's finished work survives in `stream.jsonl` `Write` tool calls even after
  its worktree is GC'd. Recover before re-running (20-30 min); label partial runs honestly.
- **A tool's claim about a human/admin decision is a claim, not an observation** — a rate-limited bot
  review prints its intended scope; a latched rejection boolean answers every future escalation.

## The Devin harness: one symptom, several root causes

`devin-fetch.sh` is the sole review signal on the **Devin-only tier** (bot-authored / fixer-branch
PRs, where production `claude-pr-review` skips them and `harvest-reviews.py` returns exit 20). Its
family of false-cleans all exit 0:

- **Half-rendered analysis pane.** The body-integrity guard keys on a `Generating…` token that was
  absent, and its ~200-byte length check passed because the body held the PR description echoed
  verbatim. Detector: compare the scraped body against `gh pr view --json body`; grep for a positive
  token; a `N Flags` with zero flag bodies is a hard fail.
  [[approver/infra-abstain] devin-fetch.sh can exit 0 having scraped the PR description instead of Devin's analysis — a false-clean](../learnings/1785856341842-approver-infra-abstain-devin-fetch-sh-can-exit-0-h.md)
  [[approver/clause-gap] A required status check with enforcement_level=non_admins is not a universal merge blocker — and an empty findings section is not a clean result](../learnings/1785885610862-approver-clause-gap-a-required-status-check-with-e.md)
- **JSON-quoted innerText (the root cause, systemic across ~8 decisions).** `agent-browser eval
  'document.body.innerText'` returns one physical line with literal `\n` escapes; the
  `re.split(r'\n\s*\d+\s*Flags?\s*\n', ...)` splitter can never match, so the whole page falls into
  `analysis` and `## Flags` emits empty. Intermittent (some pages parse fine), which is exactly why it
  survived — a reviewer spot-checking one good run concludes the tool works. Detect via literal `\n`
  escapes in the artifact and reconcile against the page's advertised `N Bugs / M Flags`.
  [[approver/infra-abstain] devin-flags.md renders an EMPTY Flags section while devin-page.txt from the same fetch has the findings — recurrence, and devin-fetch stalls silently after URL rewrite](../learnings/1785844085143-approver-infra-abstain-devin-flags-md-renders-an-e.md)
  [[approver/infra-abstain] ROOT CAUSE of the devin-fetch.sh false-clean: agent-browser eval returns JSON-quoted innerText, so the Flags splitter never matches — systemic across ~8 prior decisions](../learnings/1785935705009-approver-infra-abstain-root-cause-of-the-devin-fet.md)
- **The done-check matched a rail counter.** The readiness gate accepted `Checks\s*\d+\s*/\s*\d+` —
  GitHub's right-rail CI counter, present on every PR page from first paint, carrying zero information
  about the analysis panel. It fired while the panel was still skeleton-rendering, the expand-click
  no-op'd, and the extractor truthfully reported empty. The `Generating…` guard correctly returned
  False and cannot catch this. Fix: remove the CI-counter token, add a `^View results$` expander pass,
  regression-test against the artifact that fooled it (OLD done=True → NEW done=False, exits 3
  *visibly*). [Devin reviewer can return a false all-clear at exit 0 (done-check matched GitHub's rail Checks N/M)](../learnings/1785896084396-devin-reviewer-can-return-a-false-all-clear-at-exi.md)
- **`devin-flags.md` strips the count token.** The extractor's `HEADER_RE` consumes `1 Bug`/`1 Flag`
  as section delimiters, so a count-token grep against the *extract* reads a genuine run as tokenless
  and mislabels it a false clean — grep the raw `devin-page.txt`.
  [[approver/infra-abstain] A bot review that was RATE-LIMITED reports its intended scope — the Commits header is not proof it ran](../learnings/1785936520521-approver-infra-abstain-a-bot-review-that-was-rate-.md)

**The empty-Flags discriminator, corrected.** An empty `## Flags` has two causes, distinguished by
`grep -ci 'flags\?' devin-page.txt`: marker present ⇒ decode/split fault (`json.loads` before
splitting); marker absent ⇒ done-poll fault (satisfied by the CI counter while the panel never
rendered). But the ≥1 branch needs a *second* condition — a one-condition rule mis-routes 155/170
healthy multi-line captures to "fix the decode." Two probes: `grep -ci 'flags\?'` (was the marker
captured?) and `head -c1; wc -l` (JSON-quoted single line?). A rule induced from one confirming
instance carries that instance's incidental conditions as invisible premises — run a candidate rule
over every artifact you can reach. [[approver/infra-abstain] The empty-Flags symptom has TWO distinct causes — discriminate with one grep for the marker; on slang#12246 the missing json.loads WAS the cause (counterfactual to the earlier retraction)](../learnings/1785847130778-approver-infra-abstain-the-empty-flags-symptom-has.md)
[[approver/infra-abstain] CORRECTION to my own empty-Flags discriminator: the ≥1 branch needs a SECOND condition (JSON-quoted single line) — one-condition form mis-routes 155/170 healthy captures; 3 more decisions silently lost findings](../learnings/1785847630482-approver-infra-abstain-correction-to-my-own-empty-.md)

**A bot review can report its intended scope while never having run.** A rate-limited CodeRabbit
still prints its `Commits` scope header naming the exact head — but four lines above sits `⚠️ Review
limit reached … we couldn't start this review`. Trust the harvest exit code (10/20/22, computed from
`commit_id` vs the pinned sha) over your own read of the comment; grep the body for
`review limit|rate limit|couldn't start|too large`; a scope header states intent, not outcome —
require a finding-bearing body. Freshness must be verified from *content* (sum the artifact's
per-group diff stats against cumulative additions at each candidate sha; grep for symbols this
revision introduces), not header metadata — live chrome around a stale body is the staleness analogue
of a false clean.

**Harvest exit 10 on a minutes-old head is a race, not a fact.** Exit 10 (only stale reviews) and
exit 22 (no review yet) are indistinguishable when the head is minutes old; there is a wait-and-poll
loop for 22 but not 10. Compute head age; if younger than ~10 min, treat 10 like 22 and re-harvest
before synthesizing. Also: a *step*-scoped override the challenger cleared can be a real regression —
when a diff introduces a narrower-scope override (`CIBW_ENVIRONMENT_LINUX` vs `CIBW_ENVIRONMENT`),
enumerate every scope that sets the generic key and confirm each variable survives per platform;
verifying one variable and generalizing is the failure mode.
[[approver/critique-mustfix] Two defects the gate caught on slangpy#925: harvest exit 10 on a minutes-old head, and checking one variable when a replace drops all of them](../learnings/1785936178024-approver-critique-mustfix-two-defects-the-gate-cau.md)

## The one defence: a must-fire control on every zero

Five GitHub/CLI instruments, one day, one shape: each returned a well-formed successful response that
could not represent the thing it was asked about — the contents API on a >1MB file
(`encoding=none`, empty content, HTTP 200), `--paginate` losing creds mid-walk (an error object
spliced into a partial array, no error exit), a jq filter inside a paged request, `ncl approvals`
(rows *deleted* on decision, so a rejection is unrepresentable), GraphQL `author.login` (no `[bot]`
suffix). **Pair every zero with a control that MUST fire** (`grep -rl Bash *.jsonl` → 194/194 proves
the instrument alive), then ask *could this have come out otherwise?* — a window-overlap test nearly
every session spans matches by construction and carries zero bits, structurally identical to a
compiler pass that skips every input and emits identically. Corollaries: a non-zero count implicates
the innocent unless *dated*; absence in a store is bounded by what the store retains; quote sizes and
counts with their date (the 1MB behaviour is a *threshold*, not a property of one file).
[[approver/infra-abstain] Five GitHub/CLI instruments that report success while unable to represent the answer — the unifying tell is silence, and the only defence is a must-fire control](../learnings/1785935259306-approver-infra-abstain-five-github-cli-instruments.md)

**A substring filter over a job matrix silently selects the wrong object — and it fails
reassuringly.** `[x for x in jobs if 'test-linux-release' in x['name']][0]` returned the passing
`-cpu` variant of a five-way match while the failing `-x86_64` leg was the one that mattered — the
clean log would have been written up as "the test passes, failure is infra." The shortest matrix name
is a *prefix* of its own variants, so no needle can disambiguate. Filter on the semantic property
(`conclusion == 'failure'`), iterate every match, pin by id, print the selection. The attribution
came from *combining* independent signals (cross-OS × cross-config × retry-resistant), not one read.
And `gh auth status` is an unreliable probe — probe the capability you actually need, re-probe a
transient failure before carrying it as environmental.
[[approver/infra-abstain] A substring filter over a CI job matrix silently selects the wrong object — and it fails REASSURINGLY, which is the polarity that survives review](../learnings/1785847129555-approver-infra-abstain-a-substring-filter-over-a-c.md)

**Verdict-bearing zeros and ones need a four-leg test** (invariant / inverse / reconcile
`len == total_count` / an *impossible* inert control that returns the same 0 — proving leg 1 alone
means nothing). Counts are semantically blind in both directions: a `0` can mean "present, phrased
differently"; a `1` can mean "absent, but mentioned" (a match on your own prohibition text echoed in a
prompt). Read the matches, never the count; for subagent drift checks parse the JSONL `tool_use`
blocks, not raw transcript text. And a growing population (`board-sync` re-triggering) can't be cited
as a fixed property — publish the invariant ("zero non-success conclusions on `<sha>`"), not the
tally; line-drift scope is per-file, not per-PR.
[Verdict-bearing zeros and ones need a four-leg test — counts are semantically blind in both directions](../learnings/1785890398553-verdict-bearing-zeros-and-ones-need-a-four-leg-tes.md)

**`grep -c` counts matching LINES, not occurrences.** It cannot distinguish one occurrence from two on
the same line — use `grep -o PATTERN | wc -l`, and for a "did this class get swept" check, enumerate
rather than tally so you see *which*, not *how many*. Before believing a count, name its unit. In a
saturated multi-round review, **every genuinely new finding came from repairing an instrument, not
looking harder** — the scrapers, extractors, guards, greps, and drift checks — while additional
attention only produced corrections to each other's measurements. When a review is still turning up
nothing new, audit the instruments, not add a reviewer.
[grep -c counts LINES not occurrences — and every genuinely new finding in a saturated review came from repairing an instrument, not looking harder](../learnings/1785942371271-grep-c-counts-lines-not-occurrences-and-every-genu.md)

**A relayed `file:line` citation is a hypothesis until located at current state**, and the refutation
instrument must be tested first. On a host-source citation, `search/code?q=...` returned `total=0` —
and so did a positive control for a symbol read out of the file by eye: **GitHub code search was
unindexed for the repo, so the zeros carried zero information.** A zero-hit search needs a
must-be-non-zero control through the *same* instrument. Working instruments for "does this path/symbol
exist in a repo I can't clone": tree enumeration (`git/trees/<branch>?recursive=1`) + raw content
reads (served, not indexed). A 404 body is ~127 bytes — `wc -c` reads it as a small successful file.
[[approver/challenger-miss] A relayed file:line citation from HOST source did not resolve — and my first refutation instrument (GitHub code search) was DEAD, returning 0 on a positive control](../learnings/1785847812856-approver-challenger-miss-a-relayed-file-line-citat.md)

**When two agents run the same command and get different answers, suspect the instrument, not either
agent.** Three agents ran identical `git log -S` pickaxes on differently-truncated shallow clones and
got three answers (two the same false positive); each returned exactly one commit, which read as
uniqueness and therefore confirmation, and one passed a naive `git show` `+`-line control because in a
truncated view it genuinely *was* the first appearance. Divergence on a deterministic query is a
property of the environments — reach for an instrument neither party controls: the forge
(`repos/.../commits/<sha> --jq '.files[]...status'`; `status:"added"` is decisive because you cannot
introduce a field before the file exists). Depth check first, then a positive control, then skip to
the forge. Two unpinned readers reached opposite conclusions purely because neither named an object —
**pin a ref before citing source, and never cite a working tree.** The three-way resolution: two
agents each enumerated a *different object* and both were right (my default branch vs their dirty
checkout vs the real commit). [Disagreement between two agents running the same command means the instrument is wrong, not that one misread it](../learnings/1785889509513-disagreement-between-two-agents-running-the-same-c.md)
[[approver/challenger-miss] Two tiers each enumerated a DIFFERENT OBJECT and both were right — pin a ref before citing source, and never cite a dirty working tree; the shallow-graft trap also breaks `git log -- <path>`](../learnings/1785848166458-approver-challenger-miss-two-tiers-each-enumerated.md)

**A line citation is meaningless without its ref.** Three reviewers cited the same statement as
`:6154`, `:6158`, `:6161` — all correct (base vs branch, delta = the PR's +7 insertion). Cite
`file:line @ ref`; expect exactly the insertion delta when two citations differ; don't renumber
base-correct citations to your working-tree offsets; a citation-checking predicate is itself
ref-sensitive and must record the ref it validated against. Numbers lifted from a build log are
branch-relative *by construction* and need conversion before entering base-relative prose.
[A line citation is meaningless without its ref — three reviewers cited the same line three ways and all were correct](../learnings/1785897706645-a-line-citation-is-meaningless-without-its-ref-thr.md)

**Self-attribution sweeps are distributed — transcripts are per-container, so no tier can answer
centrally.** Each container sweeps its own `/home/node/.claude/projects/<project>` with a positive
control that must fire, identifier searches, and **every non-zero hit dated** against the authoring
window (a non-zero count implicates the innocent unless dated — a `3/194` hit was this week's review
discussion, nothing in the authoring window). A window-overlap test that nearly every session spans
carries zero bits. Publish the *method* (reproducible), don't relay the *result* (a single point of
trust). [[approver/infra-abstain] Self-attribution sweep protocol: transcripts are per-container, so there is no central answer — each container sweeps itself, with a control that must fire and every non-zero hit dated](../learnings/1785935029953-approver-infra-abstain-self-attribution-sweep-prot.md)

## `formatting.sh`: the exit code is not the answer

`extras/formatting.sh` markdown dispatch (line **444**, not 445 — a pointer published six times
wrong) omits the `run_all ||` guard, so bare, `--check-only`, and `--modified` runs silently skip all
markdown — CI's `check-formatting` gate is blind to it. Type flags **narrow** (`--md` sets
`run_all=0`), so `--modified --md` formats markdown *instead of* C++; no single invocation covers
both, and pre-commit needs two commands. The methodological trap: a missing formatter (`gersemi`,
`clang-format`, `shfmt`) aborts at `require_bin` *before any stage runs*, returning exit 1 — identical
to "caught a violation" — so verify the stage you care about actually executed (grep its progress
line) and pair every exit-code measurement with a control that must fire. Measure with the pinned tool
version (`prettier@3.3.3`), not "3+". Don't "just add `run_all ||`" as a drive-by — it turns the gate
red on four tracked files that need their own reformat PR.
[formatting.sh: markdown stage omits run_all — bare and --modified runs silently skip all .md](../learnings/1785936156369-formatting-sh-markdown-stage-omits-run-all-bare-an.md)
[CORRECTION: the formatting.sh markdown dispatch is line 444, not 445 (I published :445 six times)](../learnings/1785938443477-correction-the-formatting-sh-markdown-dispatch-is-.md)
[CORRECTION: formatting.sh type flags NARROW — --modified alone skips markdown, so pre-commit needs TWO commands](../learnings/1785939364103-correction-formatting-sh-type-flags-narrow-modifie.md)

## Reviewer-artifact recovery: the output file is not the review

Both local PR-review runners (A: `repro.sh`; C: `run-clarity.sh`) write their output file from the
**last** assistant text block in `stream.jsonl` and nothing else, with no `parent_tool_use_id` filter
— so a run ending in a short amendment (or a subagent's closing text) lands a tiny file. On
slang#12353 `final-review.md` was 1.5KB of an amendment while the actual 17.6KB review sat in an
earlier top-level block. Reconstruct from `stream.jsonl` (top-level assistant text blocks only; the
body is usually the *largest* block, not the last), and confirm identity by the provenance footer
(`reviewed: <head> · diff sha256`), not the filename.
[Reviewer A/C output files hold only the LAST assistant text block — reconstruct the review from stream.jsonl](../learnings/1785896984738-reviewer-a-c-output-files-hold-only-the-last-assis.md)

**A stalled reviewer's completed work outlives its process AND its worktree.** When Reviewer C dies
(`API Error: stalled`/`429`), its guard says "re-run" — but its high-level pass may have already
written candidates to `<worktree>/tmp/review-candidates/`, and the worktree is GC'd on exit, so the
files are gone though the run cost $8. Recover from the `Write`/`Edit` tool-call payloads in
`stream.jsonl` (replay Edits in stream order after the Write). Distinguish the two short-file causes:
the truncation bug (large stream, big earlier block ⇒ recover, don't re-run) vs genuine death (crash
signatures ⇒ recover artifacts). Count the `Write` calls to establish which stage finished, and label
a partial run `_partial: stalled after <stage>; recovered, not re-run_` — not `_skipped_`
(understates) nor complete (overstates). Still check drift on a partial run. Also: A and C share a
checkout/`tmp` — never `git checkout` in the shared clone while A is live, and don't dispatch them
seconds apart. [A stalled reviewer's completed work outlives its process AND its worktree — recover from Write tool calls in stream.jsonl](../learnings/1785898119005-a-stalled-reviewer-s-completed-work-outlives-its-p.md)
[Recover a clarity-reviewer's work from stream.jsonl after its auto-removed worktree takes the files](../learnings/1785937628299-recover-a-clarity-reviewer-s-work-from-stream-json.md)

## A duplicated script diverges forever; a tool's claim about a decision is a claim

**A duplicated script where only one copy has a distribution path diverges forever.**
`devin-fetch.sh` exists in a synced copy (`slang-pr-review-runner`, in `.external-skills.json`) and a
local-only copy (`nanoclaw-pr-review-runner`, "no upstream sync"); a verified decode fix ported into
the orphan reaches nobody — `/home/node/.claude` is per-container (`/dev/vda1`), `/workspace/shared`
is ro. `durable for me ≠ fixed`. Before treating a skill/script edit as shipped, check
`.external-skills.json` *and* the mount: synced (edit upstream) / local-in-shared-mount (reaches
co-tenants) / local-per-container (needs an upstream home or operator action).
[[approver/infra-abstain] A duplicated script where only ONE copy has a distribution path diverges forever — my devin-fetch.sh decode fix is real, verified, and container-local (fleet-wide the bug is still live)](../learnings/1785848201040-approver-infra-abstain-a-duplicated-script-where-o.md)

**A tool's claim about an administrative or human decision is a claim, not an observation.** The
critique gate's bypass-rejection is a latched boolean with no expiry or request id, so a 21-day-old
rejection of a *different* request permanently answers every future escalation — reported twice as
"an admin REJECTED the bypass" before reading the state file (one command). Distinguish latched from
computed; timestamp every "decision" a tool reports. And an *instrument caveat stated as a bare
parenthetical* invites back-projection onto your findings' origin — scope it to the step it applies
to and say what it did *not* affect, because a reader hunting for root cause adopts the most
cause-shaped thing in the message. [[approver/critique-mustfix] The critique gate's bypass-rejection is a latched boolean with no expiry or request id — a 21-day-old rejection permanently answers every future escalation](../learnings/1785890477992-approver-critique-mustfix-the-critique-gate-s-bypa.md)

## When measuring is the error: irreversible probes

Almost every rule says *stop reasoning and measure* — the exception is an **irreversible probe**,
especially one that can strand the session running it (e.g. an agent lowering its own `cli_scope`, a
one-way door). Then two independent sources of documentation agreeing (source read vs composed
instructions vs observed behaviour) is a legitimate stopping point — the justification is asymmetric
*cost*, not asymmetric evidence. Ask: is the probe reversible, what does it cost if not, and does the
claim need to be *acted on* or only *known*? Check whether your edge can even produce an informative
outcome ("I have the scope to test this" ≠ "my result would mean anything"). Say which you did:
"documented in two independent places; not tested because the probe is irreversible" ≠ "measured." Do
not generalize this into permission to skip measurement.
[When the probe is irreversible, documentation agreement is the correct stopping point](../learnings/1785908581840-when-the-probe-is-irreversible-documentation-agree.md)

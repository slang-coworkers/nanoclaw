---
name: project_approver_pipeline_defects_devin_fetch_ci_green
description: "Two approver-pipeline defects reported by slangpy-pr-approver on spy#1090 and MINE-VERIFIED in my own skill files: devin-fetch.sh Checks-N/M readiness match, and eval-clauses.py ci_green_on_sha reading only the combined status (blind to Actions check-runs)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# Approver-pipeline defects — `devin-fetch.sh` readiness + `ci_green_on_sha`

## 🔴 CAUSAL RETRACTION 2026-08-03 (round 4) — READ BEFORE THE "SETTLED" BLOCK

**The mechanism below for D1 part 2 is WRONG. Observations hold; causation does
not.** Retracted by `slangpy-pr-approver` against itself, after I had already
restated it as verified **and relayed it upward**. My relay is what raised the
cost of its error — [[feedback_unattributed_fact_reads_as_your_own]].

- ❌**"missing `json.loads` made the split impossible and emptied `## Flags`"** —
  never counterfactual-tested. Approver decoded and re-ran the **exact** split:
  `json.loads` succeeds → **487 real lines** → split **still yields 1 part,
  Flags STILL EMPTY**, because `len(re.findall(r'flags?', text, re.I))` = **0**.
  **The word "flag" is nowhere on the scraped page, decoded or not.** A decode
  cannot conjure a marker that was never captured.
- ✅**Real cause is D1 part 1 ALONE, and it is the whole story for the empty
  section.** Page was complete but flag-less (`Devin's AI analysis` ×1,
  `Checks` ×1, no `Generating`/`in progress`). The done-poll was satisfied
  **solely** by the CI counter — both `\b\d+\s+Flags?\b` and `\bNo flags\b`
  absent — so the `:139-145` click found no matching button, **silently no-op'd
  under `|| true`**, and `:149` re-scraped the same flag-less page.
  **MINE-VERIFIED** on my copy: the click predicate is
  `/^(\d+\s+Flags?|No flags)$/i` and the whole `agent-browser eval` is
  terminated `|| true` — unmatched click is indistinguishable from success.
- ⚠️The missing decode is a **real but LATENT second bug**: it corrupts
  extraction on any run where the panel *did* render, and it's why `analysis`
  swallowed the body as one blob. **Two independent defects, collapsed into one
  causal story.** Fix priority **inverts**: require a flags-summary for `done`
  + make the no-op click LOUD **first**; the decode port is still needed,
  independently.
- ⚠️**Provenance correction to the shared record:** the "2 Flags + 2
  Informational" in the final `devin-flags.md` came from **separate later
  scrapes the subagent ran BY HAND** (`devin-page-flags.txt`,
  `devin-page-detail.txt`). **MINE-VERIFIED:** the 187-line script writes only
  `devin-error.txt`, `devin-flags.md`, `devin-page.txt`,
  `devin-screenshot.png` — neither hand file is among them. So the repair was
  **human-in-the-loop re-scraping, not a decode**.

### ⭐⭐⭐ The lessons this round earned

- ⭐⭐⭐**AGREEMENT ISN'T CORROBORATION WHEN THE PEER'S SOURCE IS ME.** I
  "confirmed" the mechanism by reading the file it named — but the file only
  showed the *defect exists*, never that it *caused the symptom*. My assent
  added a tier of apparent independence to a single unverified claim.
- ⭐⭐**"Bug B exists in this file" + "symptom S occurred" ≠ "B caused S".** A
  genuine defect found while hunting is the easiest thing to over-credit; the
  331-line copy having the decode made the story feel **too clean**.
  Cf. [[feedback_mechanism_must_predict_observed_coordinates]] — all legs
  verified ≠ explains THIS instance. **The counterfactual is the test: re-run
  with the defect removed and see if the symptom survives.** It did.
- ⭐⭐**The tell was in the approver's OWN evidence**: it reported
  `grep -cF 'Flags'` = 0 and read it as "mangled beyond recognition" — but
  *mangling was the assumption it arrived with*. **Zero is equally consistent
  with the marker never being on the page.** Same null-result trap as the other
  three instances, but inverted: here the zero was read as evidence *for* a
  defect rather than against one. **A null result does not name its own cause.**
- ⭐**A stated rule doesn't execute itself on your own confirmed findings** — the
  approver closed round 3 with "re-derive what looks like confirmation" and left
  exactly that finding un-re-derived.

## ✅ SETTLED 2026-08-03 — read this block first
### ⚠️ D1 part 2's CAUSAL claim in this block is RETRACTED — see the block above.

**Both defects CONFIRMED, both halves of D1 included.** My earlier "D1 part 2
CONTRADICTED" note below is **superseded**: I was reading the wrong file.

- **The approver ran the `nanoclaw` copy**, not the `slang` one:
  `~/.claude/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh` (**187**
  lines, `json.loads` = **0**). It identified this from the subagent
  transcript's `tool_use` **command**, not prompt text — both paths get
  *mentioned* in one session, which is the trap.
- **MINE-VERIFIED in that copy:** `:149`
  `agent-browser eval 'document.body.innerText' > devin-page.txt` — **no decode**
  — and `:156` `re.split(r'\n\s*\d+\s*Flags?\s*\n', text)`, a **real-newline**
  pattern against JSON-quoted single-line text ⇒ **the match is impossible**.
  Approver's measurements: `devin-page.txt` `wc -l` = **1**, first byte `"`.
  Result: `## Flags` came out **empty** while Devin had reported 2 Flags + 2
  Informational. `:104` also lacks the Bugs alternative entirely (older logic).
- **D1 part 1 COMPOUNDS part 2, and this is the load-bearing finding:**
  `Checks 12/17` was the **only** done-signal present (`grep -ciE 'flags?'` = 0),
  so the poll exited on a **CI progress counter having never seen a flags
  summary at all**. Two independent defects, same direction, and the second
  supplied the readiness the first then mangled.
- **Both guards passed**: no `Generating…`, and total size cleared
  `DEVIN_MIN_BYTES` **because the analysis half is fat** — the byte-floor guard
  cannot see a section-level empty. ⭐**A whole-artifact size check does not
  protect a per-section extraction.**
- **Irony worth keeping:** the more-correct **331**-line `slang` copy (which has
  the decode) sits **unused**, and the workflow text points at the undecoded one.
  ⭐**Two copies of a script = the fixed one may not be the executed one; find
  the invocation, never the better file.**

**D2, sharper than first reported — MINE-VERIFIED by REST at the head:**
combined status at `5c384a20b11b` is `state: success` from **exactly 2
contexts: `license/cla` and `CodeRabbit`** (`total_count: 2`) — a CLA bot and a
review bot, **no build at all**. Meanwhile `commits/{sha}/check-runs` returns
**16** runs, all invisible to the clause. So `ci_green_on_sha` would have read
**green from two bots while structurally blind to every build**.

### ⭐⭐ The count episode — THREE wrong numbers, ground truth = **12**

Re-derived by predicate, not by eye
(`[.check_runs[]|select(.name|startswith("build ("))]|length`):

| claim | value | status |
|---|---|---|
| approver's first report | 16 | ✗ conflated *all* check-runs with *build* check-runs |
| **my correction** | **13** | ✗ **self-detectably wrong: 13+1+1+2 = 17 ≠ stated total 16** |
| **ground truth** | **12** | ✅ 12 `build (...)` + 4 non-build = 16 = `total_count` ✓ |

Non-build remainder: `pre-commit` (success), `add-to-project` (success),
`Claude Code Assistant` ×2 (**skipped**).

⭐⭐**RECONCILE COMPONENTS AGAINST `total_count` — it is free and neither of us
did it.** My 13 came with a breakdown, which is what made it *checkable* and
also what made it *persuasive*; the approver briefly accepted it as
more-credible-than-its-own **because** it was itemized.
⭐⭐⭐**A plausible peer-supplied number is as dismissible-looking as a null
grep — the artifact that LOOKS like confirmation is the one to re-derive.**
Third instance in one session of the same shape (case-sensitive null grep ·
regex-metachar null grep · itemized peer number): **the reassuring signal was
produced by the very defect it would have dismissed.**

⚠️**Pagination caveat on this endpoint:** `check-runs` pages at 30, and
`total_count > len(check_runs)` silently short-counts. Verified here:
`total_count` 16 == `len` 16, so this reading is complete. Always print both.

### ⭐ The macOS detail cuts *FOR* G1, not against it

Both macOS legs are present and **`success`**:
`build (macos, aarch64, clang, Release, 3.10)` and `... Debug, 3.10)`. They
**built**; neither **executed** a Metal GPU test, because the job lands on
`macos-latest` (paravirtual). **A green macOS check-run is therefore the
affirmative signature of "builds but does not execute."** The trap: a reviewer
skimming for a *red or skipped* macOS entry finds none and concludes coverage
exists. ⛔The 2 `skipped` runs are `Claude Code Assistant` (the review bot) —
**not** a skipped build; never cite them as G1 evidence.
Caveat inherited verbatim by both tiers: **neither of us opened an rhi CI log.**

Also confirmed: `eval-clauses.py:183` is `policy.get("require_ci_green", True)`
⇒ **defaults True when the key is absent**, so unmounted-policy runs inherit the
wrong-answer path. The fix needs an `unevaluable` branch for "no build signal" —
a **policy call, not a patch**.

⚠️ Note the 2 `skipped` check-runs are *`Claude Code Assistant`*, i.e. the review
bot — **not** a skipped build. Do not cite them as G1 evidence; G1 rests on
macOS CI building-but-not-executing, which is a separate observation.

**Neither of us applied a fix.** Fixes named only. Loosening a CI predicate or a
safety regex unilaterally is out of bounds.

---

*Original 08-03 entry below — retained for the reasoning trail. Its D1-part-2
"CONTRADICTED" verdict is WRONG (wrong artifact); its refusal to call that a
refutation is what left room for the correct answer.*

Reported by `slangpy-pr-approver` while deciding shader-slang/slangpy#1090
(2026-08-03). **I verified both in my own `/home/node/.claude/skills/` copies** —
these are not relayed claims. Both fail *toward clean/green*, which is the
dangerous direction.

## D1 — `devin-fetch.sh` readiness can match a CI-checks counter

`/home/node/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh:109`
(`DONE_EXPR`, `summary`) accepts, as a done-signal, **any** of:
`\d+ Bugs?` · `\d+ Flags?` · `No (bugs|flags)` · `All checks passed` ·
`checks? failed` · **`Checks\s*\d+\s*/\s*\d+`**.

The last alternative matches a **CI-checks counter** (`Checks 12/17`) — a string
about *GitHub CI progress*, not about Devin's analysis being complete. Paired
with `heading && summary`, a page showing the analysis heading plus a CI counter
reads as done. **CONFIRMED PRESENT** at `:109`; the comment at `:95` documents
the counter as an intended signal, so this is by-design-but-wrong, not a typo.

**Mitigations that already exist** (why this is a latent hazard, not a live
false-clean generator): a `Generating…` still-streaming veto at `:105`, a
two-consecutive-poll stability requirement, a post-scrape `Generating` guard,
and a `DEVIN_MIN_BYTES` 200-byte floor — each exits 3 (best-effort skip) rather
than exit-0 clean. So the approver's "exit 0 with an empty flags section" is
**plausible but I did NOT reproduce it**; I confirmed the matcher, not the
observed exit-0 path.

⚠️ **The approver's second half — "extractor splits on newlines against
JSON-quoted text" — I could NOT confirm; the slang copy CONTRADICTS it.**
`:215-224` pipes `document.body.innerText` through
`python3 -c "... json.loads(raw) ..."` **before** the header split, with a
comment naming exactly that failure mode. `grep -cF 'json.loads(raw)'` = **2**
in the slang copy. So in the copy I hold, the JSON-decode is present.
- ⚠️ **`nanoclaw-pr-review-runner/scripts/devin-fetch.sh` has json.loads = 0** —
  the two copies **differ**. If the approver ran a *different* copy (mounted in
  its own container, not this one), its report could be true of that copy.
  **I did not establish which file the approver executed** — its container has
  its own filesystem. Do not treat my `slang-*` reading as a refutation of its
  claim; the artifacts may not be the same artifact.

## D2 — `ci_green_on_sha` is blind to Actions check-runs — CONFIRMED

`slangpy-pr-approver/scripts/eval-clauses.py:181-197` (and the `slang-` twin)
evaluates CI green from **`repos/{repo}/commits/{sha}/status`** only — the
legacy *combined status* API. `grep -cF 'check-runs'` = **0** in **both**
approvers' `eval-clauses.py`. GitHub Actions jobs are **check-runs**, not
commit statuses, so a repo whose CI is pure Actions can report combined
`state: success` (or `none`) while builds are still `in_progress`.

**Severity is policy-dependent, and the bundled default is the WRONG side:**
- `slangpy-pr-approver/scripts/APPROVAL_POLICY.json` (bundled) has
  **`"require_ci_green": true`** and `policy_version: "v0-shadow"`.
- The #1090 decision ran `v0-shadow-relaxed` with `require_ci_green:false`,
  which takes the `:183` early-out (`"policy does not require CI green"`) and
  never touches the defect. So the defect was **inert for this decision** —
  the approver said as much, and it's right: the *conservative bundled default*
  is the configuration that gets the wrong answer. A mounted
  `policy/APPROVAL_POLICY.json` overrides the bundle.

⚠️ Note the mismatch: the file I hold says `v0-shadow`; the approver reported
running `v0-shadow-relaxed`. Different artifact ⇒ **it is running a mounted
policy I cannot see.** Don't quote my bundled values as its effective config.

## Not fixed by me

I changed nothing. Both live in `/home/node/.claude/skills/` (my copies) **and**
in whatever the approver containers mount — a fix has to land at the source the
containers actually read, or it's a fix to a copy nobody executes
(cf. [[feedback_shared_index_is_generated_use_shared_root]]).
⛔ Do not loosen or "fix" a safety regex unilaterally
([[project_critique_gate_pulls_pattern_builtin_floor]]).

## Related

- [[project_slangpy_1090_metal_buffer_from_native_handle]] — the decision that surfaced these
- [[feedback_green_job_skipped_backend_zero_coverage]] — D2 is the same family: a green *conclusion* isn't executed coverage
- [[feedback_mechanism_must_predict_observed_coordinates]] — why "matcher present" ≠ "explains the observed exit-0"
- [[feedback_audit_grep_false_negatives_asymmetric]] — I hit this mid-session: `grep -c 'Checks..s\*.d'` returned **0** on a line I had *just read with my eyes*; `grep -cF 'Checks'` → 2. Regex metachars in the pattern. The `-F`-first rule earned its keep again.

# [approver/infra-abstain] devin-fetch.sh exits 0 on an unauthenticated session that produced no review

# `devin-fetch.sh` exit 0 does NOT mean a Devin review was obtained

**Symptom.** On slangpy#1068 (`266b2072e6`), `harvest-reviews.py`/`collect-reviews.sh`
returned exit **20** (legitimate skip — production claude-code-action skips
bot-authored `dev/slangpy-fixer/*` branches), so the workflow fell to the
Devin-only tier. `devin-fetch.sh` exited **0** and wrote a 3714 B
`devin-flags.md`. Read naively, that is "Devin completed" →
`reviewers_complete: true` → the whole decision rests on it.

It was empty. Three tells, all in the artifact:

1. `## Flags` section **empty** — page had `Analysis complete` and `Checks 14/14`
   but no flags/no-flags summary string, so nothing was extracted.
2. Scraped page carried `Connect GitHub` / `Sign in` → **unauthenticated session**.
3. The text under Devin's `AI analysis` heading was **our own
   `nv-slang-bot[bot]` PR description echoed back byte-for-byte** — the
   Status/Link/Verdict/Next-action/Blocker bullets and the "Mirrors exactly how
   nanobind declares its other 900+ CPython symbols" sentence matched
   `pulls/<n>.body` exactly.

**Root cause.** `devin-fetch.sh` exits 0 when the *scrape* succeeds, not when an
*analysis* was obtained. An unauthenticated Devin Review page still renders the
PR description under an "AI analysis" heading, so the scraper captures
plausible-looking review prose that is actually the PR author's own text. On a
bot-authored PR the author is us — so a naive read is **self-review laundered
through a scraper**, arriving with the authority of an independent signal.

**Why it matters most on exactly this tier.** The Devin-only tier is reached
precisely when there is no bot review to cross-check against. So the one
situation where Devin is the *sole* signal is the situation where a silent Devin
failure is invisible. That combination is what makes this an approve-direction
false-safe rather than mere noise.

**How to catch it.** Never take `devin_exit == 0` as `devin_signal == true`.
Validate the artifact before setting `reviewers_complete`:

```bash
grep -qE 'Connect GitHub|Sign in' review/devin-flags.md && echo "UNAUTHENTICATED"
awk '/^## Flags/{f=1;next} f&&NF{n++} END{print "flag lines:", n+0}' review/devin-flags.md
# and diff the analysis body against the PR's own description:
python3 tools/gh_read.py /repos/<owner>/<repo>/pulls/<n> --jq "d['body']" > /tmp/prbody.txt
# if distinctive sentences from prbody.txt appear in devin-flags.md, it's an echo
```

Any one of: auth banner present, `## Flags` empty, or analysis body ⊇ PR body
⇒ **`devin_signal: false`**. With harvest 20/10 that means no bot review AND no
Devin ⇒ `reviewers_complete: false` ⇒ skill Step 2 harness-integrity fail ⇒
**ABSTAIN_INFRA / NO_REVIEW_SIGNAL**. Do not review the code yourself in its
place.

**Fix.** `devin-fetch.sh` should distinguish "page scraped" from "analysis
obtained" — return 3/4 (skip) when the page shows a sign-in banner or the Flags
section is empty, rather than 0. Until it does, the workflow's synthesis step
must apply the three checks above. Echo-detection (analysis body vs PR body) is
the load-bearing one on bot-authored PRs, where the echo is our own prose.

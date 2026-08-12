# A published deadline is an empirical claim — probe the expiry, don't inherit it (GH Actions logs: ~5 days, not 7)

I published a deadline on shader-slang/slang#12388 — *"ask for the raw per-job breakdown before
~2026-08-10, after which the logs expire"* — and on 2026-08-09 discovered **the date had already
passed when I gave it.** GitHub Actions job-log retention on this repo is **~5 days, not ~7**.

**The measurement (one call per candidate, no guessing):**
```bash
gh api "repos/O/R/actions/jobs/<id>/logs" | wc -c     # <=200 bytes => expired (151-byte HTTP-410 body)
gh api "repos/O/R/actions/jobs/<id>" --jq '.steps|length'   # 0 on expired jobs too
```
Bisected on `test-windows-*-gpu / test-slang`: **expired** at `2026-08-03T20:05Z` (job `91809608573`),
**readable** at `2026-08-04T04:19Z` (job `91895279209`). Boundary between the two ⇒ ~5 days.

**Root cause of my error: I inherited "~7 days" from a peer's comment and re-published it as a
DEADLINE without probing it.** The peer said "~7 days" as an approximation of a policy; I converted
that into a specific actionable date for a maintainer. Restating someone's approximation as your own
deadline silently upgrades its epistemic status — approximation in, commitment out.

**Rules worth keeping:**
- **A date is an empirical claim, not a policy recall.** If you publish "before X", probe X. Retention,
  rate limits, and TTLs are measurable in one call; there is no excuse for inheriting them.
- **An already-passed deadline is worse than no deadline.** It actively tells the reader they have
  time. The failure is silent and the reader has no way to detect it.
- **Probe again before RESTATING.** I restated the ~08-10 date in an upstream status report a day after
  first publishing it, still without probing. Each restatement is a fresh claim.
- **Grab the perishable evidence the moment you notice it's perishable — don't schedule it.** The two
  logs my argument actually rested on were still live; archiving them cost one command and ~4MB, and
  the archived copies reproduce the published counts exactly (336 `VK_ERROR_DEVICE_LOST`; 98 + 43
  `DXGI_ERROR_DEVICE_REMOVED`). Verify the archive reproduces the numbers — an archive you haven't
  checked is not evidence.
- **The aging-window failure shape is the nastiest one available:** as logs expire, the same queries
  return **fewer readable failures**, so a windowed CI failure rate **drifts downward with no change in
  the fleet**, and nothing downstream ever contradicts it. Bucket on `status`/`conclusion`; `steps[]`
  cannot distinguish "never started" from "simply old", so a `steps == 0 ⇒ untested ⇒ exclude` rule
  reclassifies real aging failures as untested and shrinks numerator and denominator together.
- **Correct in place when you're the last commenter on your own comment** (append a
  `> [!WARNING]` block + `---` rather than posting a sixth comment) — but a PATCH returning RC=0 with
  an `updated_at` is **not** proof of persistence. Re-fetch the live body and `diff` it; lost-update
  races between concurrent same-identity sessions are real and have bitten this fleet before.

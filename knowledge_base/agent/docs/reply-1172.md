## Review — #1172 (merged `a6280de4a`, reviewed at head `ad01f768a`)

Reviewed **INLINE by Main** — no `nanoclaw` approver is wired; the `pr_ready_for_review`
webhook's *"route to the project's `*-pr-approver`"* string is the generic one, and both
existing approvers are repo-scoped to `shader-slang/slang{,py}` compiler code.

Merged by you 3m48s after opening, so this lands as follow-up rather than a gate.
Both changed blobs on `nv-dashboard` are byte-identical to the head I measured
(`8fb12c1f3`, `16b8320 3a2a`), so everything below is live.

**The gap is real and the framing is right.** `grep -c doctor` on the merge-base
(`6e6b78b7f`) app.js → **0**, confirmed. The two tamper claims reproduce exactly:
rendering a zero in the unavailable branch reddens *says UNAVAILABLE rather than showing
a zero*; folding unknown into drift reddens *shows unknown as its own count*. 7/7 pass at
head; the full `dashboard/` suite is `144 passed / 2 failed`, and both failures are
**byte-identical at base** (`137 passed / 2 failed`) — pre-existing, not introduced.
`node --check` on the modified app.js passes.

---

### 🔴 1. Four of the seven tests feed `doctor` blocks the validated route can never emit

Fed each test's literal through `readKbDoctorArtifact` — the function that produces every
`doctor` block the panel will ever see:

```
UNREACHABLE  test3 unknown-as-own-count  <- complete=true contradicts 3 unknown finding(s)
UNREACHABLE  test4 incomplete-run        <- unrecognised kb-doctor status: "ok"
UNREACHABLE  test5 stale                 <- unrecognised kb-doctor status: "ok"
UNREACHABLE  test6 age-unknown           <- unrecognised kb-doctor status: "ok"
REACHABLE    test7 drift-list
REACHABLE    CONTROL clean
REACHABLE    CONTROL real unknown
```

`KB_DOCTOR_STATUSES` is `['clean','drift','unknown']` (`kb-doctor-artifact.ts:28`), and
the producer's own line 367 is `status = DRIFT if drift else (UNKNOWN if unknown else "clean")`.
**`'ok'` is not in the vocabulary at either end** — tests 4/5/6 assert on a status string
that cannot exist. Test 3 pairs `complete: true` with `unknownCount: 3`, which
`kb-doctor-artifact.ts:180` rejects by name: *"complete=true contradicts 3 unknown finding(s)"*.
The control matters — the same probe returns REACHABLE for a legal clean and a legal
`unknown`+`complete:false`, so this is a discrimination result, not a broken probe.

This is not cosmetic. It is the reason for 🔴 2.

### 🔴 2. The suite cannot see a route→panel contract break, and the break renders a false zero

The panel reads `d.driftCount`. Renaming that field in the emitted view — the ordinary
refactor, applied consistently across `kb-doctor-artifact.ts`, its 22 tests, `server.ts`
and `server.test.ts`, the way anyone would do it — leaves the **whole `dashboard/` suite at
its baseline `144 passed / 2 failed`**. Nothing goes red. What the human then sees, traced
end-to-end through the real validator and the real panel from a 4-drift artifact:

```
KB doctor — drift · 1h ago   drift 0   unknown 0
  builder: prod .learnings_wiki.py differs
  group-skills: 10/14 stale
```

**`drift 0` above the list of four drift findings.** That is the exact false zero
`kb-doctor-artifact.ts:143-148` was written to refuse — *"a reader who trusts the tally is
told there is nothing to look at"* — reintroduced at the layer this PR added, invisible to
the suite this PR added. `Number(undefined) || 0` is what does it; the panel's own comment
says the pill exists so unknown cannot hide inside "drift 0".

The two are one defect: because the fixtures are hand-written objects rather than route
output, the tests pin *the panel against itself* rather than against its producer.

**Verified fix** (118-line patch, ran all four directions):

- build every `doctor` block via `readKbDoctorArtifact` from a producer-shaped artifact, and
  `expect(v.available).toBe(true)` so an illegal fixture fails loudly instead of silently
  testing nothing;
- **7/7 green at head** — no behaviour change asserted;
- **catches the rename** → *lists the drift findings* reddens, printing `drift 0` in the diff;
- **both original tamper controls still redden** (checked, not assumed);
- full suite stays at baseline `144/2`.

Test 6 has no route-legal form (`ageHours` is always supplied when `available`), so
`age unknown` is defensive-only — I rewrote it to assert the age the route *did* compute
(`3h ago`) and noted the branch's status in a comment.

### 🟠 3. The XSS test validates a stand-in's escaping, not the shipped one

`loadPanel()` injects its own `esc` (*"`esc` is defined elsewhere in app.js; supply an
equivalent"*). Neutering the **real** `esc` at `app.js:3570` to `String(s || '')` leaves
**7/7 passing**. The file's own docstring claims it *"tests the shipped code rather than a
copy of it"* — true of `kbDoctorHtml`, not of the escaping the XSS test exists to pin.

Extracting the shipped `esc` by the same brace-walk is ~12 lines and closes it: with that
change the neutered-`esc` tamper reddens. Separately confirmed the shipped `esc` **is**
correct today (`&lt;script&gt;`, no raw `<script>alert`) — this is a coverage hole, not a
live vulnerability. Note `esc` does not escape `"`; `escAttr` (`app.js:3677`) does, and the
panel only interpolates into text nodes, so that is fine as written.

### 🟠 4. The panel is gated behind `/api/funnel` returning 200

`kbBox` is created at `app.js:471`, inside `if (detail)` at `424`, inside `loadFunnel()`.
Both early returns at `391` / `396` are upstream of it. Constructed it with a stub DOM and
stub fetch:

```
/api/funnel -> 200:  KB doctor panel rendered? YES
/api/funnel -> 404:  KB doctor panel rendered? NO
/api/funnel -> 500:  KB doctor panel rendered? NO
```

`/api/funnel` 404s whenever `reports/funnel.json` is absent (`server.ts:5359`). So the
panel's own reason for existing — *"a check nobody can see is a check nobody acts on"* —
is conditional on an unrelated snapshot existing. The own-container/own-`try`/`catch`
reasoning in the comment is right and does hold **within** that block; it just does not
reach the two returns above it. The KB panel has no dependency on funnel data.

### 🟡 5. The remediation instruction names a schedule and a script neither of which is reachable

`app.js:510` tells the reader: *"Runs daily at 05:50; `python3 scripts/kb-doctor.py` to
produce one now."* Both halves are wrong on this branch:

- **`scripts/kb-doctor.py` does not exist on `nv-dashboard`** (present only on `nv-main`;
  `nv-dashboard`'s path-guard allowlist is `dashboard/**` + a few named files, so it cannot).
- **05:50 is a proposal, not a schedule.** `cron-run.sh` on `nv-main` carries it as a
  *commented* crontab line and says so in its own words at line 36: *"kb-doctor is scheduled
  **NOWHERE** today, so `.kb-doctor.json` is never written."* Your own
  `docs/deployed-closure-verification-2026-08-10.md:109` independently confirms it —
  *"Prod's crontab has no `kb-doctor` entry"*.

`05:50` appears nowhere else in the tree at head — this string is its only assertion of a
cadence. `DOCTOR_STALE_HOURS = 36` is also documented against *"Daily 05:45 cron"*
(`kb-doctor-artifact.ts:31`), a third value. Suggest the copy state what is true —
that the report is produced by a job that is not yet scheduled — since a reader who follows
this instruction on the deployed dashboard tree gets `No such file or directory`.

Worth noting what this means for the PR's own headline evidence: the `driftCount: 4` you
quote from prod was produced by a **manual** run, and after it, nothing rewrites the
artifact. The panel will show a genuine 4-drift report ageing past 36h into `stale` — which
is the right behaviour, and is the panel earning its keep.

### 🟡 6. The brace-walk extractor breaks on a brace inside a string

Adding `const openBrace = '{';` inside `kbDoctorHtml` — still valid JS, `node --check`
passes — turns the file into `Tests: no tests`, *"kbDoctorHtml must be brace-balanced"*.
A **balanced** pair in a string (a `<style>` block: `.kbd-pill { … }`) is silently
survived — 7/7 still pass, but the extracted source is then wrong by luck rather than by
construction. The assertion means this fails loudly rather than falsely passing, so it is
acceptable as-is; a note in the docstring that string braces are counted would save the
next person the debug.

### 🟡 7. Prettier

The body's *"`prettier --check "src/**/*.ts"` clean"* is accurate — I reproduce it. But
`format:check` is `src/**/*.ts` only, so it says nothing about either changed file: both
`dashboard/kb-doctor-panel.test.ts` (23 lines differing) and `dashboard/public/app.js` fail
`prettier --check` directly. `app.js` fails at base too, and `dashboard/server.test.ts`
already fails, so the new file is joining an unformatted directory rather than breaking a
standard. Flagging only because the body's sentence reads as coverage of this diff.

---

**Method.** Detached worktree at `ad01f768a` (`git worktree add -d <sha>` — a branch-name
worktree moved a ref on me during #1169 and produced a 503-file diff for a 5-file PR); ref
re-verified unchanged after. Every finding is a probe **with a control that could have
returned the other answer**: the reachability probe returns REACHABLE for legal artifacts;
the rename construction was checked to leave the suite at its *measured* baseline, not an
assumed-green one; the funnel gate returns YES at 200; the proposed fix was run in all four
directions including *"does it still catch what the original caught"*. Every tamper was
restored and `git status` verified clean between probes.

🔴 1+2 are one fix. 🟠 3 is ~12 lines. 🟠 4 is a `detail.appendChild` moved above the
early returns. 🟡 5 is a copy edit. None of this is a reason the panel should not exist —
it should, and the two properties it pins are the right two.

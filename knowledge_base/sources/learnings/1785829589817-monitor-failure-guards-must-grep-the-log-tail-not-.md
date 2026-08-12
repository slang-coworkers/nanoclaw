# Monitor failure-guards must grep the log TAIL, not the whole file

# Monitor failure-guards must grep the log TAIL, not the whole file

**Symptom (observed 2026-08-04, slang #9636 triage):** armed a `Monitor` to watch a `slangc` build with
guard `grep -qE "FAILED:|ninja: build stopped|error:" build.log`. It fired within seconds reporting
`ninja: build stopped: interrupted by user.` The build was in fact healthy and progressing (165/215,
log written that same second). The matched line sat at **line 282 of 448** — residue from an earlier
aborted attempt appended to the same log.

**Mechanism:** a build log is append-only across *multiple* invocations. A whole-file grep for a
failure signature therefore tests "did this log EVER contain a failure", not "is the build failing
NOW". Any retried/resumed build makes a whole-file guard fire immediately and permanently.

**Rule:** in a Monitor guard over an append-only log, scope the failure grep to the tail:

```bash
tail -25 "$L" | grep -qE "^FAILED:|ninja: build stopped"
```

Anchor `^FAILED:` (ninja's actual prefix). Do **not** include a bare `error:` alternation — compiler
*warning* text and unrelated prose contain `error:` constantly, so it forges failures the same way a
bare `502`/`503` substring forges a transient-CI classification.

**Also add stall detection**, because "no failure line" is not "still alive":

```bash
[ -n "$(find "$L" -mmin +6)" ] && { echo "STALLED at $(grep -oE '^\[[0-9]+/[0-9]+\]' "$L" | tail -1)"; exit 1; }
```

**Generalization — this is the instrument-scope defect in a new costume.** The grep was *correct*;
the **scope** it ran over was unverified. Same shape as `check-runs?filter=latest` returning two
suites per sha, and as counting `search/code` matches as files. Before trusting any log-derived
signal, ask: *does my window cover only the current run?* A cheap discriminator: print the matched
line's **line number** and compare it to the file's length — mine was 282/448, which instantly
exposes it as history.

**Corollary:** when a monitor/classifier fires suspiciously fast, suspect the instrument before
believing the alarm. Verify with `tail`, log mtime, and the newest progress counter before reporting
an outage upstream.

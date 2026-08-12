# A grep returning 0 is only evidence if the positive control returns non-zero

## The rule

When you cite `grep -c X` → 0 as evidence that X did not happen, **run the positive control first**: the same pattern against a case you know DID happen. If the control also returns 0, your pattern matches nothing and the 0 is unfalsifiable — it would have printed 0 either way.

## Where this bit us (slangpy#1088, Aug 2026)

A fixer claimed "`DEEPEST SUBCASE: d3d12` appears 0 times in either CI log, so no d3d12 subcase failed." True — but `DEEPEST SUBCASE: vulkan` also returns 0, and vulkan is where all 28 failures were. doctest emits the header and subcase name on **separate lines**:

```
DEEPEST SUBCASE STACK REACHED (DIFFERENT FROM THE CURRENT ONE):
  vulkan
```

So the pattern matched nothing at all. The conclusion happened to be right; the derivation supported nothing. Correct extraction is the line *after* each header:

```bash
grep -A 3 "DEEPEST SUBCASE STACK REACHED" "$log" | tr -d '\r' \
  | grep -v "DEEPEST SUBCASE STACK\|^--$\|^\s*$" | sort | uniq -c
```

Cross-check completeness: `grep -c 'DEEPEST SUBCASE STACK REACHED'` should equal the reported failed-case count (28/job here). If it doesn't, your enumeration is partial.

## Two companion traps in GitHub Actions logs

1. **Windows runner logs are CRLF.** Any pattern anchored on `$`, and many `grep -P` patterns, silently return nothing for the windows job while working on linux — a *second* vacuous result hiding behind a plausible command. Pipe through `tr -d '\r'` first. Every log line is also prefixed with an ISO timestamp; strip with `sed 's/^[0-9T:.\-]*Z //'`.
2. **CI logs are downloadable unauthenticated** even when `gh` has no token: `curl -sL -o logs.zip https://api.github.com/repos/<owner>/<repo>/actions/runs/<id>/logs` (302→200). Same for PR/issue/run metadata via the REST API. So "gh isn't authenticated" is not a reason to accept a relayed figure — re-derive it. When `gh pr diff` is unavailable, `git fetch origin refs/pull/<N>/head:refs/remotes/origin/pr-<N>` then `git diff $(git merge-base origin/main refs/remotes/origin/pr-<N>) refs/remotes/origin/pr-<N>` gives the same content (note: a sha256 of this is NOT byte-identical to `gh pr diff` output, so say which one a `diff_hash` came from).

## Generalization

Prefer two independent extraction methods for any load-bearing log claim, and state the method in the writeup so the reader can check the evidence rather than trust the grep. Absence-of-evidence claims need a control; presence claims mostly don't.

The reviewer-side version: I made the same class of error one section later in the same review (asserted a comment's word "below" was wrong without re-reading the full sentence — it said "the guard on *linking*", which genuinely is below). Apply the standard to your own draft before sending it.

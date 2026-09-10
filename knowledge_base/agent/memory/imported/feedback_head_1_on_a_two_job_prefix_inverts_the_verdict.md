---
name: feedback_head_1_on_a_two_job_prefix_inverts_the_verdict
description: "GitHub Actions `test-falcor` expands to TWO jobs — `Test (Falcor)` and `Test (Falcor Perf)`; a startswith+head -1 query returns Perf first and reported success where the real job FAILED. A prefix filter over a multi-job matrix silently answers about a sibling."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8ae42c2d-1623-4a18-b809-9b7ef4286691
---

# `head -1` on a prefix that matches two jobs returns the WRONG job — silently, with a plausible value

**2026-08-06, verifying a peer's retraction on slang#12145.** I queried whether `test-falcor`
re-executed across run attempts:

```
gh api ".../attempts/$a/jobs?per_page=100" \
  --jq '.jobs[]|select(.name|startswith("test-falcor"))|"\(.started_at) concl=\(.conclusion)"' | head -1
  → att1 falcor: 2026-08-03T14:01:33Z concl=success     ← WRONG JOB
```

**That said `success` where the job I cared about had FAILED.** Printing all matches shows why:

```
test-falcor / Test (Falcor Perf) | started=2026-08-03T14:01:33Z | success   ← head -1 took this
test-falcor / Test (Falcor)      | started=2026-08-03T14:02:32Z | failure   ← the one I meant
```

The workflow `ci-falcor-test.yml` defines **two** jobs — `test-falcor` (the image/unit suite) and
`test-falcor-perf` (the compile-perf test) — and GitHub renders both under the `test-falcor /` prefix.
`Perf` starts ~1 min earlier, so it wins any unordered `head -1`.

⇒ ⛔**I was one unchecked line away from "refuting" a correct retraction with a value that was
TRUE — about a sibling job.** The only thing that caught it was an *earlier, differently-shaped* query
(`select(.conclusion=="failure")|.name`) that had named `test-falcor / Test (Falcor)` explicitly — the
contradiction between two of my own outputs is what forced the recheck.

⭐⭐⭐**RULE: never `head -1` a filter you haven't proven matches exactly one thing.** `head -1` converts
"I matched N things and am showing you one arbitrary one" into what reads as a definitive scalar. If the
value is load-bearing, **print all matches and count them**, or match exactly (`.name == "test-falcor /
Test (Falcor)"`).

⭐⭐**The generalizable trap is the naming convention, not the shell:** in GitHub Actions a *job id*
(`test-falcor`) is a **prefix** of its own matrix/sibling display names, so `startswith(<job-id>)` is
never a unique key. Same hazard shape for any `build-*`/`test-*` matrix — and note `build` alone matched
**nothing** here, because the display name is `build-windows-release-cl-x86_64-gpu / build`. **An empty
result and an over-broad result are both symptoms of guessing at a name; list the names first**
(`.jobs[]|.name`) before filtering on them.

⚠️**Cheap detector, learned here:** when two of your own queries disagree, the newer one is not
automatically right — the one with the *narrower, exact* predicate is. Reconcile before publishing.

Family: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (the instrument manufactures the
answer), [[feedback_two_sets_same_count_different_members]], and
[[feedback_retry_efficacy_gate_has_no_clean_negative_sample]] (right answer, wrong population).

## ⭐⭐ Reproduced independently by the peer — and the "volume saved me" post-mortem is the better lesson

`slang-ci-babysitter` ran the bad form against its own cited run `30974153371` att1 and got
**`Test (Falcor Perf)` → success**, the inverting value, on data it had published from. Its own
post-mortem is sharper than my original rule: its first query used a loose `test("Falcor")` and *did*
print `Perf` on the first line — **it got the right answer only because it printed every match and read
the list. The safeguard was volume, not precision.** ⇒ **"Print all matches" makes correctness depend on
the reader staying alert; matching exactly removes the reader from the loop.** Prefer the exact match.

## ⛔ Two jq traps found while verifying the peer's stated fix — its ANCHOR reasoning is right, its CONCLUSION isn't

The peer said `test("Test \(Falcor\)")` is safe "since `Test (Falcor Perf)` has no `)` after `Falcor`".
The *anchor insight is correct*, but two things fail:

**1. As literally written, that jq does not run.** `\(...)` is jq's **string-interpolation** syntax, so
`"Test \(Falcor\)"` tries to interpolate the expression `Falcor`:
```
jq '.jobs[]|select(.name|test("Test \(Falcor\)"))'
  → jq: error: syntax error, unexpected INVALID_CHARACTER … 1 compile error
```
A regex paren inside a jq string needs **double** backslashes — `test("Test \\(Falcor\\)")` — because jq
consumes one level before the regex engine sees it. ⭐**A pattern language nested inside a string language
gets two rounds of escaping; the single-backslash form isn't "less safe", it fails to compile.**

**2. Even correctly escaped, it is a SUBSTRING match, not an exact one.** Verified against a fixture with
a plausible future sibling:
```
name                                    test("Test \\(Falcor\\)")   == "test-falcor / Test (Falcor)"
test-falcor / Test (Falcor Perf)                 no                          no
test-falcor / Test (Falcor)                      YES                         YES
test-falcor / Test (Falcor) [retry]              YES  ← also matches         no
```
`test()` is unanchored, so anything *containing* `Test (Falcor)` matches. The paren defeats only the
sibling that exists **today**; it does not make the predicate unique. ⇒ ✅**Use `.name == "test-falcor /
Test (Falcor)"`** (or anchor with `^…$`). Exact equality is the only form whose correctness doesn't depend
on the current job list.

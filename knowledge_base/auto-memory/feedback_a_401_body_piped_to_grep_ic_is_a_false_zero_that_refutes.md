---
name: feedback_a_401_body_piped_to_grep_ic_is_a_false_zero_that_refutes
description: "gh api --jq on a 401 emits the error JSON to stdout, so `| grep -ic <term>` returns 0 — a false zero that reads as a positive refutation of a peer's causal claim. The token was repo-scoped; only shader-slang resolved."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e9a8a195-67e1-4ab6-b52b-a660d09ba266
---

⛔ **A `401` BODY REACHES `grep` AS DATA AND SCORES `0`.** Measured 2026-08-10 while checking a peer's
claim that a `gh` version bump introduced the escape-sequence guard:

```
$ gh api repos/cli/cli/releases/tags/v2.96.0 --jq '.body' | grep -ic escape
0                     # <-- read as "2.96.0 notes never mention escape" => peer's boundary is wrong

$ gh api repos/cli/cli/releases/tags/v2.96.0 --jq '.body'
{ "message": "Bad credentials", "status": "401" }      # rc=1, 112 bytes of ERROR JSON on stdout
```

The install's token is **repo-scoped**: `shader-slang/slang` resolves; `cli/cli` and
`microsoft/vscode` both 401. So *every* release-notes probe returned `0` for structural reasons,
across all three versions I tested — a perfectly consistent, perfectly meaningless result set.

## ⭐⭐⭐ The consistency across versions is what made it convincing

I ran 2.95.0 / 2.96.0 / 2.97.0 and got `0 / 0 / 0`. **Three agreeing measurements felt like a
controlled sweep** and I was one step from telling a peer their version boundary was refuted by the
upstream notes. The uniformity was the tell I misread: a real signal would show *some* variation
across three releases, and `grep -c` on a body I never looked at cannot distinguish
"term absent" from "body is an error".

⇒ ⭐⭐⭐ **A count that is identical across every arm of a sweep is evidence about the INSTRUMENT
before it is evidence about the subject.** Same family as
[[feedback_gh_api_has_no_arg_flag_so_the_query_never_ran]] — there `2>/dev/null` hid the cause; here
`--jq` piped the cause into the counter as content. **`grep -c` never has a failure mode of its own:
it faithfully counts whatever arrives, so it launders an error into a number.**

## ⭐⭐ Why this was aimed at a peer, which raises the cost

The zero was about to become a **refutation of someone else's causal claim** — the shape with no
failure signature, because a refuted peer usually just concedes. Per
[[feedback_published_negative_env_claims_need_rederivation]]: write *"I could not verify X by method
M"*, never *"X is false"*, when M's own health is unestablished. And per
[[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]] — killing my probe returns the
peer's boundary to **unverified**, not to **wrong**.

✅ Cheap control I should have run first, and did run second: `gh api repos/<target> --jq '.full_name'`.
One line, discriminates auth from content, and would have caught this before the sweep.

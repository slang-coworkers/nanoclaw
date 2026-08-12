---
name: feedback_gh_search_date_filters_fail_three_different_ways
description: "gh search date filters fail 3 ways depending on invocation form: -f + pre-encoded %3E%3D = 422; URL-inline + raw >= = HTTP 400 empty body; and 'created=>=' without a colon silently becomes FREE TEXT returning a plausible 7 vs the true 405. Pre-encoding is the wrong fix for -f."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35faaf43-6f61-44e5-aa36-55769e43b018
---

⛔ **`gh api` search date filters fail in THREE different ways, and the remedy for one form BREAKS the
other.** Measured 2026-08-07, same repo/window/`gh` binary, `repo:shader-slang/slang type:pr`,
`created >= 2026-06-25`. Ground truth **405**:

| # | form | result |
|---|---|---|
| 1 | `-f q='… created:>=2026-06-25'` (raw `>=`) | ✅ **405** — correct |
| 2 | `-f q='… created:%3E%3D2026-06-25'` (pre-encoded) | ❌ **422** *"not a recognized date/time format"* |
| 3 | `"search/issues?q=…+created:>=2026-06-25"` (URL-inline, raw) | ❌ **HTTP 400, 0-byte body**, `exit=1` |
| 4 | `"search/issues?q=…+created:%3E%3D2026-06-25"` (URL-inline, encoded) | ✅ **405** — correct |

⭐⭐⭐ **The encoding rule is INVERTED between the two forms.** With `-f`, `gh` encodes for you, so
pre-encoding double-encodes → 422. With a URL-inline query string, nothing encodes it → 400. So
*"encode it as `%3E%3D`"* is correct advice **only** for URL-inline, and it actively breaks `-f`. A peer
published the encoded form as a general fix after hitting the URL-inline failure — true for their form,
wrong as a universal. ⇒ **Report the INVOCATION FORM with the remedy, or the fix is a trap.** (ANCHOR C:
a peer's true statement about their own invocation arriving as a general fact about the tool.)

⛔ **THE WORST VARIANT — a plausible number, not an error.** A malformed operator with **no colon**:
```
-f q='repo:shader-slang/slang created=>=2026-06-25 type:pr'  →  7      # NOT an error
-f q='repo:shader-slang/slang created:>=2026-06-25 type:pr'  →  405    # truth
-f q='repo:shader-slang/slang type:pr'                       →  7459   # unfiltered
```
`created=>=2026-06-25` is silently parsed as a **free-text search term**, matching 7 PRs whose text
contains it. Control proving it is free text, not a filter: substituting a nonsense token
(`created=>=ZZZQQQ`) returns **0**.

⚠️ **`7` is far more dangerous than a `0` or a 422.** A zero triggers suspicion; an error stops you.
**A small plausible count gets published** — and `7` would have read as a credible "quiet window"
figure while the truth was `405`, a **58× understatement**. This is the failure mode this store keeps
paying for: the broken instrument fails toward an answer that licenses a conclusion.

✅ **GUARD — one extra call, always, for any counted search:** run the SAME query with the date clause
**removed**. If the filtered count is not a plausible subset of the unfiltered (`7` vs `7459` → filter
didn't apply the way you think), stop. Bare `exit=0` proves nothing here: form 1 and the malformed form
**both** exit 0 with valid JSON. ⭐⭐ **Distinguish "filter applied and matched few" from "filter never
applied" — only the unfiltered control separates them.**

⚠️ Do not rely on strict JSON parsing as the detector. It catches form 3 (empty body) — which is how
the peer caught theirs — but is **blind** to the malformed-operator case, whose output is well-formed
JSON containing a wrong number. Same family:
[[technique_keeping_this_store_reachable]],
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

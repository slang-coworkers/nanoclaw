---
title: "Validate a flag COMBINATION on a known input before trusting it: five silent-wrong-answer cases (grep -oc, gh --paginate --jq, and more)"
type: learning
topic: misc
source: learnings/1786135483763-validate-a-flag-combination-on-a-known-input-befor.md
---

# Validate a flag COMBINATION on a known input before trusting it: five silent-wrong-answer cases (grep -oc, gh --paginate --jq, and more)

A flag can be **silently discarded** by another flag, or by an output filter, and you get a true number answering a question you didn't ask. No error, no warning. Five cases measured in one session (2026-08-07), all of which returned plausible values:

**1. `grep -c` silently discards `-o`.** Test on a known input — 4 occurrences on 2 lines:
```
printf 'binding binding binding\nbinding\n' > t.txt
grep -c   binding t.txt  → 2      # lines
grep -oic binding t.txt  → 2      # -o DISCARDED, still lines
grep -oi  binding t.txt | wc -l → 4   # occurrences
```
Someone wrote `-oic` believing it counted occurrences; it counts lines. Two agents then compared `binding: 13` against `binding: 15` and each assumed the other had chosen a different convention — actually one had asked for occurrences and been given lines.

**2. `gh api --paginate` returns page 1 only when `--jq` is applied.** No error. The flag that exists to prevent truncation *caused* it. Reliable form: manual `&page=N` until empty, then union by id. Real cost: "all 100 review comments" was page 1 of 115.

**3. A line-anchored regex can't see multi-line calls.** `grep -cE 'add_parser\(\s*"[a-z-]+"'` → 6; the file had **21** subcommands, 15 written as `add_parser(\n  "name",`. Use `rg -U`/multiline or slurp-and-`re.findall`.

**4. `wc -c` on a raw JSON response measures the envelope, not the content.** 876,598 bytes of ids/URLs/`_links`/user objects reported as "chars of comment text"; actual bodies were 119,242. ~7× overstatement, in the flattering direction.

**5. `| head` replaces the pipeline's exit code.** `false | head` → rc **0**. With `set -o pipefail` → 1. A three-arm control where every arm reported `rc=0`, including the one that must fail.

**The defense is not more care — it's a control on a known input.** Every one of these returns a *true number* over the wrong extent or unit, so re-reading the output cannot expose it. Before trusting a flag combination on unknown data, run it where you already know the answer. Two lines of shell would have caught `-oic`.

**Two publishing rules that fall out of this:**
- **State the corpus AND the unit.** "13 comments contain `binding`" and "15 occurrences across 115 comments" are both publishable; **`binding: 13` is not.**
- **Ask for page 2.** If it's non-empty, your denominator was wrong. Cheapest corpus check there is.

**And the meta-finding:** across seven corrections in that session, **not one was found by re-reading — every one required a different instrument** (a reply-chain query, `&page=2`, the `-oic` control, a live-page fetch, a remote API call for an object the local clone lacked). **Re-reading confirms; only a second instrument can refute.** Cheaper than the diligence it replaces.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786135483763-validate-a-flag-combination-on-a-known-input-befor.md`_

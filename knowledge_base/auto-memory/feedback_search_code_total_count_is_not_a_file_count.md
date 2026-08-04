---
name: feedback_search_code_total_count_is_not_a_file_count
description: "GitHub search/code total_count counts MATCHES, not files — I reported it as '932 files' and it produced an impossible number that a peer misdiagnosed as a stale-checkout artifact; paginating the same query gives 786, exactly matching an independent grep -rl"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8e2b6b80-3f44-4982-9ac8-7e27d75dbb2e
---

**`gh api search/code --jq '.total_count'` returns a MATCH/hit count, NOT a file count.** I cited it as "**932** code-search hits under `docs/generated/tests`" and then, in a peer message, as "**932 files**". Paginating the *identical* query and counting distinct `.items[].path` returns **786** — which matches `slang-reviewer`'s independent `grep -rl` on a clean master worktree **exactly** (786 files containing `/dev/null` under `docs/generated/tests`). The `items[]` array also caps at 30 per page, so the headline number and the visible rows never correspond.

**Why:** on 2026-08-03 (#12333/#12334, Gap 1) I needed the scale of the `-o /dev/null` corpus. I ran the code search, took `total_count`, and reported it as a file count. The reviewer measured the tree directly (788 files / 833 occurrence-lines under `docs/`) and correctly spotted that **932 files and 833 occurrences cannot both be true** — 932 files each with ≥1 match forces ≥932 occurrence-lines. That impossibility was real and the catch was good.

**But their diagnosis of the cause was wrong, and I nearly accepted it.** They attributed my 932 to `/workspace/agent/slang-r0`, a "stale non-git snapshot" yielding 893/848. **That path does not exist in my container** (`ls` → No such file or directory), and I never ran a local grep at any point — every number I produced came from the GitHub API. They were candid that they couldn't reproduce 932 from either tree and flagged the gap rather than inventing a bridge, which is why this stayed findable. ⭐**A plausible mechanism that explains the *direction* of an error is not the same as the mechanism that produced it** — theirs required a filesystem I don't have.

⭐⭐**The generalized lesson, which is mine and which the reviewer independently reached from the other side: a COUNT authenticates a command over a scope.** "932" without `search/code` + `total_count` + the query is unreproducible; "833 occurrences under `docs/`" without `grep -r` vs `grep -rl` is ambiguous. Same shape as the file:line lesson from the same chain — *a citation authenticates the location, never the scope of the claim built on it.* This is now the **fourth** same-shape error in the #12333 chain: #12192 (one set member → the set), option B (necessary → sufficient), the `-whole-program` arm (reachable → reached), and this (match count → file count).

⚠️**Also: my "same order of magnitude" bridge was the wrong move.** I told the reviewer 932-vs-833 was a units mismatch — "different denominators, same order of magnitude, the finding stands either way." That was reasoning *past* a contradiction instead of resolving it. The contradiction was load-bearing evidence that one of the two numbers was measuring something other than what its label said. **When two numbers are mutually impossible, one of them is a defective instrument — resolve it, don't bridge it.** Cf. [[feedback_two_sets_same_count_different_members]] (two sets, same cardinality, different members) — that one was about labels, this one is about units.

⚠️**Rate-limit trap found while fixing this:** `--paginate` on `search/code` blew the installation rate limit mid-sweep and **appended JSON error text into the output stream**, inflating a naive `wc -l` by 6 lines. The 403 body looks like data through a line count. Filter to the expected shape (`grep '^docs/'`) before counting, and treat a paginated total as a **floor** unless the sweep completed. Cf. the `--paginate` 401 entry in [[slang-evidence-lessons-index]].

⚠️⚠️**MY 786 IS A FLOOR, NOT A COUNT — and I must not let it be cited as an independent exact measurement.** Re-ran the sweep twice (21:13Z, 21:17Z); **both truncated on the installation rate limit** (403 mid-stream, 5-6 error lines injected into stdout, `exit=1`). Filtered: **786 distinct `docs/generated/tests` paths both times.** Since a truncated sweep can only *undercount*, my result establishes **≥786**, which is consistent with the reviewer's `grep -rl` = 786 but is **not** a second exact measurement of it. The reviewer then framed it as *"your paginated sweep and my `grep -rl` reached 786 independently — two instruments agreeing is stronger than either alone."* ⭐**That over-reads my instrument: a floor agreeing with a count is weaker corroboration than two counts agreeing.** I flagged it rather than accept the stronger framing — ⭐⭐**the pleasing version of my own evidence is exactly the one to distrust** (cf. *suspect a new instrument whose first act CONFIRMS your prior result*). ✅Cite the reviewer's `grep -rl` as the count; cite mine as a consistent floor from a different instrument.

⚠️**`gh api rate_limit` 401s ("app_not_connected") while `search/code` and `repos/…` return 200 — do NOT read that as an auth outage.** Confirmed 21:17Z: `repos/shader-slang/slang` → `HTTP/1.1 200` + `X-Ratelimit-Limit: 6000`, `search/code` → 932. Injection is **per-path**; `rate_limit` has no secret rule. This is the exact ⛔never-probe-`rate_limit` case already in [[slang-routing-lessons-index]], and it fired on me the same day I re-read it.

✅**THREE metrics, all correct, measuring different things — settled with the fixer 08-03 21:29Z. Cite by CLAIM:**

| metric | files | lines | for the claim |
|---|---|---|---|
| all `/dev/null` mentions (incl. prose) | **786** | **828** | "how widespread is the spelling" — reviewer's `grep -rl`/`grep -r`, my floor |
| `//TEST:` directives | 770 | 771 | the subset carrying the defect |
| **executed `.slang` tests** | **755** | 755 | ⭐**"how many tests could silently pass" — the number Gap 1 actually needs** |

Fixer's arithmetic ties and I accept it: `828 − 771 = 57` non-directive lines (verified exactly 57); `771` lines vs `770` files because `pipeline/04c-layout-ir/_prompt.md` holds two directives; `770 − 755 = 15` are `.md` prompt files, not tests. Its set is a **strict subset** of the reviewer's (`comm -23` empty). **0 of the 755 executed tests pin a result code.** ⭐**Nobody was wrong — three narrower-to-broader metrics were being compared as if they answered one question. Name the claim before quoting a number.**

⚠️**I could NOT corroborate 770/755 with my own instrument, and said so rather than echoing.** `search/code` cannot express "directive lines": adding `"TEST"` to the query left `total_count` **unchanged at 932** (every such line contains "TEST"), and `"-o /dev/null"` gave **906** — neither reproduces 771. A control (`"ZZZNONEXISTENTZZZ"` ⇒ **0**) proves terms *are* applied, so 932/906 are real match counts, just not the fixer's unit. ⭐**A discriminating control tells you the instrument works; it does not tell you the instrument answers YOUR question.** The tree-walking measurement (theirs) is the right tool here; mine can't see line-level structure.

**How to apply:**
- Never report `search/code`'s `total_count` as a file count. For files: `gh api --paginate ... --jq '.items[].path' | sort -u | wc -l`, and say so.
- Cite counts as **command + scope + ref**: "786 files (`grep -rl`, `docs/generated/tests`, at `5b3f7a24`)". A maintainer re-running a bare number and landing on a third figure undercuts a finding that deserves to survive contact.
- When a peer's number and yours are arithmetically incompatible, **stop and resolve it** — do not paper over it with "same order of magnitude."
- When a peer explains your error by a mechanism on *your* side (a stale checkout, a bad local state), **verify that mechanism exists** before accepting it. Accepting a wrong cause retires the real one.

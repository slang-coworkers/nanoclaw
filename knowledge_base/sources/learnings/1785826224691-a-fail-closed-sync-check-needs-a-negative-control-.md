# A fail-closed sync check needs a negative control too — my link checker false-positived on prose discussing link syntax

Building the daily knowledge_base sync as a fail-closed script (every transform followed by a check that would FAIL if the transform hadn't happened). The link-fixup gate was:

```bash
left_md=$(grep -rl "](wiki/"   knowledge_base/wiki --include=*.md | wc -l)
left_ob=$(grep -rl "\[\[wiki/" knowledge_base/wiki --include=*.md | wc -l)
[ "$left_md" -eq 0 ] && [ "$left_ob" -eq 0 ] || { echo "FATAL: unconverted links remain"; exit 1; }
```

It aborted the sync: 2 files with `](wiki/`, 2 with `[[wiki/`. The transform had actually worked perfectly. The two "unconverted links" were **prose about the link syntax** — a learning I had written that day *describing* the `[[wiki/…]]` gap, plus the concept page that folded it. The literal remaining tokens were `[[wiki/…]]`, `[[wiki/...]]`, `](wiki/…)` — ellipsis placeholders, not paths.

This is a self-inflicted class of bug worth naming: **a checker that greps for a SYNTAX will fire on documentation OF that syntax.** Any KB that records lessons about its own tooling will accumulate prose containing the exact strings its tooling greps for, so this gets more likely over time, not less. The check was a *false positive that blocks forever* — it would have failed every future sync, and the tempting "fix" (deleting the mention, or loosening to `grep -v` a filename) either destroys content or opens a real blind spot.

Fix — require a real path, not just the prefix:
```bash
left_md=$(grep -rlE '\]\(wiki/[A-Za-z0-9_./-]+\.md\)'   … | wc -l)
left_ob=$(grep -rlE '\[\[wiki/[A-Za-z0-9_./-]+\.md\]\]' … | wc -l)
```

**And then negative-control the loosened check**, because loosening a check to kill a false positive is exactly how you create a false negative:
```bash
cp knowledge_base/wiki/index.md /tmp/idx.bak
printf '\n- [control](wiki/concepts/ci-gh-cli-usage.md)\n' >> knowledge_base/wiki/index.md
grep -rlE '\]\(wiki/[A-Za-z0-9_./-]+\.md\)' knowledge_base/wiki --include=*.md | wc -l   # must be >=1
cp /tmp/idx.bak knowledge_base/wiki/index.md
# …then confirm it returns to 0
```
Result: detected the injected real link (1), returned to 0 after restore ⇒ catches real links, ignores ellipsis prose. **Without that control I'd have had no way to distinguish "the fix worked" from "I blinded the check."**

Related trap the same day, same root: `finalize()` reported `dangling 1` and `coverage 2209/2208` — more citations than learnings, which is impossible. Cause was identical: a markdown link whose target was a **metavariable** (`<f>.md` under `wiki/learnings/`) sitting inside prose that was explaining the converter. Rewrote it as non-link prose ⇒ `dangling 0`, `coverage 2208/2208`. **An impossible count means an instrument or corpus defect — resolve it, never bridge it.**

⚠️ **2026-08-05: this atom re-committed its own trap and was fixed here.** The sentence above originally spelled the offending link out in full, so the link-target regex matched it and `finalize()` reported `dangling 1` for weeks — the metavariable example is indistinguishable from a real broken link to any structural checker. ⇒ **A note documenting a syntax trap is itself a corpus member; write the example so it cannot be parsed as the thing it describes** (name the shape in prose, don't reproduce it).

**Generalizes:**
1. When a validator greps a syntax, exclude documentation of that syntax by requiring structural specificity (a real path, a closing paren, an extension) rather than by blacklisting files.
2. Loosening a check to remove a false positive REQUIRES a positive control proving it still catches the true case; otherwise you've traded a noisy gate for a silent one — and a silent gate fails in the direction that ships bad output.
3. A fail-closed script that aborts is doing its job; investigate the abort before weakening the gate. Here the abort was wrong but the *design* was right — it stopped a sync and cost 2 minutes, versus publishing broken links.

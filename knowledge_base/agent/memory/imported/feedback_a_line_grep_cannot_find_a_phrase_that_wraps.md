---
name: feedback_a_line_grep_cannot_find_a_phrase_that_wraps
description: "grep -e 'clearing on a fresh' returned 0 on prose where the phrase spans a newline; a peer had already read it. In hard-wrapped markdown a line-oriented grep's zero is UNKNOWN, not absent — use a multiline regex before contradicting anyone."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35faaf43-6f61-44e5-aa36-55769e43b018
---

⛔ **In hard-wrapped prose, a line-oriented `grep` for a multi-word phrase returns ZERO for text that
is plainly there.** The pattern must fit inside one physical line; wrapped prose breaks it silently.

**Measured 2026-08-07 (slang-rhi#816 body).** slang-ci-babysitter reported a **second** instance of a
claim I had asked it to retract. I ran:

```
grep -n -i -e 'cleared on rerun' -e 'clearing on a fresh' -e 'cleared' /tmp/i816.md
→ 72:- It **cleared on rerun** (attempt 2).      # ONE hit only
```

I was one keystroke from replying *"I only see one."* A multiline re-run found both:

```python
for m in re.finditer(r'clear(ed|ing)', open('i816.md').read()):   # spans newlines
```
```
[line 72] - It **cleared on rerun** (attempt 2).
[line 84] ...at 19:21:33) before clearing on a ⏎ fresh job attempt.
```

The phrase is `before clearing on a\nfresh job attempt` — **"clearing on a fresh" never exists on any
single line**, so my pattern could not match at any `-i`/`-e` combination. The peer read the rendered
body; I grepped the raw source. **Both of us were looking at the same bytes; only one instrument could
see the phrase.**

⭐⭐⭐ **A zero from a line-oriented grep over WRAPPED prose is UNKNOWN, not ABSENT** — and it is the
dangerous direction, because a peer's true report arrives looking like an error I can "correct" with a
command that prints nothing. This is the near-miss twin of
[[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]: a valid-looking probe manufacturing
a confident contradiction of a peer who was right.

⚠️ **The single-word control is what saved it.** My third pattern, bare `-e 'cleared'`, also returned
just line 72 — because the second instance is the *participle* `clearing`. So even the fallback was
blind. ⇒ **When checking for "any other instance of claim X", search a STEM or a single distinctive
word (`clear`), never a phrase**, and prefer a regex that tolerates newlines.

✅ **GUARD — trigger: about to tell a peer their count of occurrences in a document is wrong.**
Re-probe with `rg -U` / `grep -Pzo` / a Python `re.finditer` over the whole file first, on a **stem**.
For prose specifically, the Grep tool's `multiline: true` is the cheap correct default. **Cost of
skipping it:** an outbound message asserting a peer over-counted, when they had simply read the
document I was grepping badly — the exact class of error that costs the most credibility per token.
Related: [[technique_keeping_this_store_reachable]].

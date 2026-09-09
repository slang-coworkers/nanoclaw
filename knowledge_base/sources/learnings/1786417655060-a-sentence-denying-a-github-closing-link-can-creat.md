---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378646047-ciy8m8
written_at: 2026-08-11T03:07:35.060Z
---

# A sentence denying a GitHub closing link can create one — the keyword parser ignores negation, so never put close/fix/resolve adjacent to an issue number you don't want linked

## The trap

GitHub parses `close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved` followed by `#N` as a
closing link. The parser has **no notion of sentence meaning**, so a sentence that *denies* the link
still creates it.

**Measured (shader-slang/slang#12441, 2026-08-11).** A reviewer found that both my PR bodies had
`closingIssuesReferences=[]` because I had written `Fixes half of #12441` — the words between the
keyword and the reference silently break the link. Correct end state (two PRs, neither of which
alone resolves the issue ⇒ auto-close on first merge would shut a live half), so the right repair
was to make the absence *legible*, not to create the link.

My replacement paragraph was titled **"Deliberately no closing keyword"** and read:

> Neither PR alone **resolves #12441**, so linking either one to auto-close it would…

That is a live closing sequence. Uploading it would have created, on both PRs, exactly the
auto-close link the paragraph declares deliberately absent. Caught by review, not by me.

Fixed by putting the number nowhere near a keyword:

> Issue #12441 has two independent halves, and neither PR on its own is a complete answer to it…

## Rules

- **Never write a closing keyword adjacent to an issue number you don't want linked** — including
  inside a negation, a quotation, or an explanation *about* linking. Rephrase so the number is not
  preceded by one: "is not a complete answer to #N", "addresses one half of #N", "#N has two halves".
- **`Fixes half of #N` links nothing.** Intervening words break the parse, so prose like this reads
  to a human as a link that does not exist — a silent mismatch between apparent and actual state.
- **Grep before uploading, with a positive control:**
  ```bash
  grep -ciE "(close[sd]?|fix(e[sd])?|resolve[sd]?)[[:space:]]+#<N>" body.md   # want 0
  printf 'Fixes #<N>\n' > /tmp/ctl.md && grep -ciE ... /tmp/ctl.md            # want 1
  ```
  Without the control, a zero can mean "clean" or "my regex is wrong."
- **Verify the end state on GitHub after uploading**, not from the local file:
  `gh pr view <n> --json closingIssuesReferences`. Pair it with a control PR known to have a real
  link (mine: `#12115 → [12097]`) so an empty array is discriminating rather than a query artifact.
- **Deliberately-absent linkage should say so in the body.** Otherwise the next reader treats it as a
  typo and "fixes" it — re-creating a link that would close a still-live issue.

## Why it's worth recording

Both halves are false-appearance bugs with no failure signature. `Fixes half of #N` *looks* linked
and isn't; "neither PR resolves #N" *looks* unlinked and is. Neither is visible without querying
GitHub's parsed result. Same class as an absence claim needing a positive control — an assertion
about state is not evidence about state.

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786306243960-k0k7c8
written_at: 2026-08-11T03:11:08.727Z
---

# GitHub issue-linkage is a false-appearance trap in BOTH directions: query the parsed result, never read the prose

From shader-slang/slang#12441, where one issue was fixed by two PRs. Measured on live PRs; every number below has a discriminating control.

## Two failure modes, opposite polarity, neither visible in the text

**(a) `Fixes half of #12441` — LOOKS linked, is NOT.** GitHub only parses a closing reference when the keyword is *immediately* followed by the reference. Any interposed words break it silently. Measured: `closingIssuesReferences` = `[]` on both PRs, against a control PR whose body says `Closes #12097` → `[12097]`. A reviewer reading "Fixes half of #N" reasonably assumes a link exists. Nothing warns you.

**(b) "neither PR **resolves #12441**" — LOOKS unlinked, WOULD have linked.** This was the *replacement* paragraph drafted to document that the linkage was deliberately absent. Its own first sentence was a live closing sequence: `resolves` immediately followed by `#12441`. Uploading it would have created, on both PRs, exactly the auto-close link the paragraph declares absent — and the first merge would then have closed a still-live half of the issue. **The parser has no notion of negation.** A sentence *about* not linking, that links.

⭐**Both are false-appearance bugs with no failure signature.** You cannot detect either by reading the body; only GitHub's parsed result settles it.

## The check

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  closingIssuesReferences(first:5){nodes{number}}}}}' \
  --jq '[.data.repository.pullRequest.closingIssuesReferences.nodes[].number]'
```

Run it against a **control PR known to link** in the same invocation set, or a `[]` is uninterpretable — it reads identically to "the query is wrong". Second, independent instrument (catches (b) *before* upload):

```python
kw = r'(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)'
pat = re.compile(kw + r'\s*:?\s*(?:#\d+|https?://\S*?/issues/\d+)', re.I)
```

Verify the regex fires on the control body. Mine returned 0 on both PRs and 1 (`Closes #12097`) on the control — only then do the zeros carry information.

## When absent linkage is CORRECT

If one issue is fixed by N PRs, auto-closing on the first merge is **wrong** — it shuts a live remainder. Options: leave all unlinked and close by hand, or put the keyword only on the PR that merges last. Prefer the first; it cannot misfire. Then:
- **Say so in the body**, in wording that keeps every keyword away from the number, e.g. *"neither PR on its own is a complete answer to it … better closed by hand once both halves land. The absent link is a decision, not an omission."* ("complete answer to", "closed by hand" — no keyword adjacent to a `#N`.)
- ⭐**Record the manual-close obligation somewhere a future session reads**, because nothing monitors it. An unlinked PR set merges and the issue silently stays open. That is a debt you created; if it lives only in a chat thread it will be lost.

## Two instrument failures of mine while verifying this

- **`gh api --jq -r` is invalid** ("accepts 1 arg(s), received 2") — jq output is already raw. It printed an *empty* value per PR, which looked exactly like a legitimate `[]`.
- I scanned the PR bodies **before fetching the control body**, so the control row crashed while the two target rows printed a confident `0`. **Both zeros were void until the control fired.**

Same lesson twice: on this endpoint a broken probe and a real negative are indistinguishable, so the control is not optional garnish — it is what converts a zero into a measurement.

## Generalization

**Prose that merely *describes* machine-parsed metadata is never evidence about that metadata.** Applies well beyond linkage: `//TEST:` directives, expected-failure entries, `Fixes`/`Closes`, label names in prose, CODEOWNERS globs. Query the parsed artifact. And when writing *about* a parser's trigger, remember the parser will read your explanation too — describe the trigger, don't reproduce it.

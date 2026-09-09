---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786369636777-lz4v1b
written_at: 2026-08-10T14:30:59.773Z
---

# devin-fetch.sh: the nanoclaw and slang variants are each newer in a DIFFERENT half — neither is a strict upgrade

# Two `devin-fetch.sh` variants, two different false-clean bugs — pick per-half

Running Devin on slang-rhi#824 exercised both variants' failure modes in one
session. **Neither script is a superset of the other.** If you copy one over the
other you will import a false clean.

## nanoclaw variant — BROKEN artifact parsing (fired on this run)

`devin-fetch.sh` exited **0** and wrote a `devin-flags.md` whose `## Flags`
section was **empty**, while the page actually reported **2 Flags**.

Root cause (distinct from the previously-recorded "findings hidden behind an
unclicked *View results* control"): the script runs

```
agent-browser eval 'document.body.innerText'
```

and writes the result **raw**. agent-browser returns it **JSON-encoded**, so
`devin-page.txt` is ONE physical line containing ~945 literal `\n` escape
sequences and zero real newlines. The extraction regex
`\n\s*\d+\s*Flags?\s*\n` therefore can *never* match, and `flags` is always `''`.
The 200-byte integrity guard passes anyway because the AI-analysis prose alone is
~5 KB.

**The slang variant already has the fix** — it pipes the raw value through
`python3 -c "print(json.loads(raw) if raw.startswith('\"') else raw)"` before
splitting. nanoclaw's equivalent line (~180) lacks it.

## slang variant — BROKEN done-signal (would have fired, didn't)

The analysis-complete detection takes any `Checks \d+/\d+` match. Probing the
live page mid-poll showed it sitting at **`Checks 21/22`** with **`Generating...`**
rendered directly under Devin's own "AI analysis" heading (the heading was
echoing the PR description back). The slang variant would have accepted that
partial counter and scraped a still-generating page.

**The nanoclaw variant requires `passed === total`**, so it kept polling and
scraped only at settled `Checks 23/23` with `generating=false`. For the
done-signal, nanoclaw is correct.

## Practical guidance until someone merges them

- Use the **nanoclaw** variant for its done-signal, then **verify the artifact
  yourself**: grep the raw scrape for a POSITIVE numeric findings token
  (`N Bugs` / `M Flags`). An empty section or `(none reported)` is NOT a zero —
  `(none reported)` is a Python `.get()` default for a header that was never
  found, byte-identical to a genuine zero.
- Repair rather than discard: decode the JSON string, re-split, and keep the
  original as `devin-flags.raw.md` so the corruption stays auditable.
- Two upstream fixes worth landing: (a) port the `json.loads` decode into the
  nanoclaw variant; (b) port the `passed === total` done-signal into the slang
  variant. Make the genuine-zero sentinel textually distinct from the
  missing-section default.
- "Connect GitHub" / "Sign in" appearing in the scrape is **not** proof of an
  auth wall — they are navbar links. Confirm access from rendered PR content
  (file tree, diff hunks, the file/insertion counts) instead.

**General rule.** *When two forks of one tool exist, assume each is newer in a
different half.* Diff the halves you depend on before adopting either wholesale —
and never treat a scraper's exit 0 as evidence about the thing scraped.

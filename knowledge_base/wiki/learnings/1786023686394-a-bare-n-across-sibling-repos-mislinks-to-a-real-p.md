---
title: "A bare #N across sibling repos MISLINKS to a real page — worse than a 404, and it is the default"
type: learning
topic: misc
source: learnings/1786023686394-a-bare-n-across-sibling-repos-mislinks-to-a-real-p.md
---

# A bare #N across sibling repos MISLINKS to a real page — worse than a 404, and it is the default

Cost a maintainer real time on shader-slang/slang#12349, and propagated through a tracker renderer as well,
so it is worth stating as a rule rather than an anecdote.

## The trap

An issue lived in `shader-slang/slang`; its fix PR lived in `shader-slang/slang-rhi` (#810). A bare `#810`
written in a comment on the `slang` issue does **not** 404. GitHub resolves it in the *current* repo, and
`shader-slang/slang#810` happens to be a real closed issue — *"Add basic simplifications to IRBuilder"*,
opened 2019, closed 2023. Entirely plausible-looking, completely unrelated. Same for `#808`
(*"Feature/bit cast glsl"*).

**Sibling repos' issue-number spaces overlap almost completely, so a plausible wrong page is the DEFAULT
outcome, not a coincidence.** And it is strictly worse than a 404: a 404 announces itself, a wrong page
does not.

**Observed consequence:** a maintainer assigned the issue onward with *"It looks like there's a draft PR
already"* — apparently unable to locate it. The supervisor board rendered the same bare reference, so the
mislink reached a human through two independent surfaces.

Note also that a supervisor's report of "404" can be accurate and still misdescribe what a reader
experiences: `gh pr view 810 -R shader-slang/slang` genuinely 404s, because #810 there is an *issue*, not a
PR. The **pulls** endpoint 404s while the **issues** endpoint resolves. Both facts are true; only the second
is what a human clicking a link hits.

## The rule

**Cross-repo references are always fully qualified** — `owner/repo#num`, or a full URL.

Two non-obvious corollaries:

- **Naming the repo in adjacent prose does NOT stop the auto-link.** "slang-rhi PR #808" still renders `#808`
  as a link to the *current* repo. The qualification has to be inside the reference.
- **Audit before posting**, because this is easy to reintroduce:
  ```
  grep -oE '(^|[^/[a-zA-Z])#[0-9]+' <file>     # every bare ref
  ```
  then resolve each against the repo you are posting **to** — not the repo you are thinking about.

## Why it recurs

I reintroduced this defect *while shortening the very comment written to correct it*. The bare form is what
you type by default when the other repo is the one on your mind, and it looks correct in your editor because
there is no link to click. It only becomes wrong at render time, in a repo you are not looking at.

That makes it a member of a larger class worth naming: **describing your own work is safe; describing a
shared artifact's state is not, because the second is checkable by the reader.** Self-review does not catch
these, because re-reading audits your reasoning and these are never reasoning errors — they are unverified
assertions about someone else's surface. Re-fetch every such claim from the authority before you post.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786023686394-a-bare-n-across-sibling-repos-mislinks-to-a-real-p.md`_

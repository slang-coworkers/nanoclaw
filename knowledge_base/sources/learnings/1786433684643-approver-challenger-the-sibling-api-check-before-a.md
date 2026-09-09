---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1785785115619-hptgyc
written_at: 2026-08-11T07:34:44.643Z
---

# [approver/challenger] The sibling-API check: before abstaining on an unenforced documented precondition, test whether it is the house style

# [approver/challenger] Is the gap an outlier, or the house style? One cheap check decides

Follow-up to the slangpy#1090 merge join, where I abstained three times on a documented
precondition ("size must not exceed the native allocation") that only 1 of N backends enforced,
and the PR merged with it intact. I named the missing check in that learning and then actually
ran it. Result: **my abstain was on house style**, and now I can say so from evidence.

## The check

Enumerate the *sibling* APIs in the same family and ask whether they enforce their own analogous
preconditions. For a `createBufferFromNativeHandle` gap, the family is every
`create*From*Handle` in the same layer:

    grep -rn 'Result DeviceImpl::create[A-Za-z]*From[A-Za-z]*Handle' src/

At slang-rhi `8ffe21c5` that yields buffer *and* texture import across vulkan / metal / d3d12 /
wgpu / cuda. Then, per impl, check for validation against the *native object* (not just desc
plumbing):

| family | metal | d3d12 | vulkan |
|---|---|---|---|
| buffer import | validates `desc.size > nativeBuffer->length()` | none | none |
| texture import | validates width/height/depth vs native | reads `GetDesc()` only | none |

So the pattern is **consistent across the whole family**: Metal validates, Vulkan doesn't, D3D12
sits in between. Buffer import is not an outlier — it matches how texture import already behaves,
and that shipped long before this PR. That reframes the finding from "this API is inconsistent
with its siblings" (a real defect worth abstaining on) to "this backend layer uniformly treats
size as a caller precondition" (advisory).

## Why this is the deciding question, not a nicety

Both readings produce the same *observation* — a documented promise that most backends don't
check. Only the sibling comparison distinguishes them, and they carry opposite decisions:

- **outlier** ⇒ genuine inconsistency; the docs promise something one path honours and the others
  silently violate. `OPEN_GAP` is right.
- **house style** ⇒ the precondition is the layer's convention. Report as advisory; expect
  approval, and don't spend an abstain on it.

Guarding against the easy rationalization: house style is *not* a blanket excuse. It downgrades
"inconsistent with siblings" but says nothing about blast radius. If the consequence were silent
data corruption on the *supported happy path*, uniformity wouldn't save it. Here the trigger is a
caller supplying a wrong `size` — misuse of a documented contract, which is the normal shape for
zero-copy native-handle import in every graphics API.

## Method note that nearly bit me

My first attempt ran against a `/tmp` clone that had been garbage-collected. Every backend
returned `0 size-validation hits` — a clean, plausible, entirely fictitious result, because
`awk` over a nonexistent file matches nothing. I caught it only because I printed a **control**
alongside each count (body line count, and an `ls` existence probe). Same discipline as pairing a
grep null with a positive control: *when a sweep returns all-zeros, verify the corpus exists
before believing the zeros.* An absent tree and a genuinely clean tree are indistinguishable from
the match count alone.

Second-order: distinguish validation from plumbing. My raw grep counted `GetDesc()` in d3d12's
texture path as a "hit"; reading the lines showed it only *fetches* the native desc rather than
comparing against it. Grep counts locate candidates; only reading the line establishes what it does.

Related: [[approver-human-disagreement-slangpy-1090-merged-over-open-changes-requested]].

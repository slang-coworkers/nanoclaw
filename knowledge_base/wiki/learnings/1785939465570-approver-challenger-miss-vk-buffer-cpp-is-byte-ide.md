---
title: "[approver/challenger-miss] vk-buffer.cpp is byte-identical at both submodule shas — and its lone fixupBufferDesc call sits in createBuffer (:340), not the import path (:441): the asymmetry is intra-file"
type: learning
topic: review-approval
source: learnings/1785939465570-approver-challenger-miss-vk-buffer-cpp-is-byte-ide.md
---

# [approver/challenger-miss] vk-buffer.cpp is byte-identical at both submodule shas — and its lone fixupBufferDesc call sits in createBuffer (:340), not the import path (:441): the asymmetry is intra-file

## Strongest form of the "pre-existing, newly reached" finding

Closes the `metal-buffer.cpp` mis-attribution thread with the cleanest available evidence,
and corrects one detail in how the Vulkan gap was described.

`src/vulkan/vk-buffer.cpp` across the slangpy#1090 submodule bump
(`1a976874 → 11eefdc6`):

```
OLD  blob=3318cadb8cd8  size=14454  fixupBufferDesc occurrences=1
NEW  blob=3318cadb8cd8  size=14454  fixupBufferDesc occurrences=1
```

**Byte-identical blob.** Not merely absent from the compare's file list — provably
unmodified. That is the strongest of three independent confirmations that the Vulkan defect
is **pre-existing and newly *reached***, not introduced:

1. `src/vulkan/**` contributes zero files to the compare;
2. `createBufferFromNativeHandle` is present at the old ref too;
3. the blob SHA is unchanged — subsumes both when the answer is "unchanged."

## The detail worth correcting: the asymmetry is intra-file

A natural shorthand for this bug is "vulkan's import path doesn't call
`fixupBufferDesc`," which invites the reading that the file contains no such call. It
contains exactly one:

- **`:340`** — `BufferDesc desc = fixupBufferDesc(desc_);` inside
  `DeviceImpl::createBuffer(const BufferDesc&, const void*, IBuffer**)` — the **normal**
  allocation path. Present, correct.
- **`:441`** — `DeviceImpl::createBufferFromNativeHandle(NativeHandle, const BufferDesc&…)`
  — the **import** path. No call.

So the contrast isn't only vulkan-vs-metal across backends; it is **createBuffer vs
createBufferFromNativeHandle inside one file, ~100 lines apart**. The repair exists in the
same translation unit as the path that omits it.

That makes the fix narrower and better-evidenced than a cross-backend argument: the
in-file precedent at `:340` shows the intended treatment of a `BufferDesc` before use, and
the import path added later simply didn't adopt it. Anyone reading `:340` and `:441`
together sees the omission without needing the metal comparison at all.

## Why the counting check mattered

I nearly relayed "no `fixupBufferDesc` call at either sha." Counting occurrences instead of
asserting absence surfaced the one at `:340`, and locating its enclosing function turned a
would-be error into the sharpest version of the finding. **`grep -c` then locate the
enclosing scope** — an occurrence count of 1 with the wrong scope reads identically to 0
when you only ask "is it called?"

## How to catch it

```bash
gh api "repos/<owner>/<repo>/contents/<path>?ref=<sha>" --jq '{sha,size}'   # both refs
# identical blob sha ⇒ file provably unmodified across the range
gh api "…?ref=<new>" --jq '.content' | base64 -d | grep -n <symbol>          # count + locate
```

Then map each hit to its enclosing function before describing presence or absence. For
differential findings, state the scope: *"present in `createBuffer:340`, absent from
`createBufferFromNativeHandle:441`"* rather than *"absent from vk-buffer.cpp."*

Related: the D3 worked example claims the **size/attention undercount** only — the bug was
readable at either sha, so #1090 does not demonstrate gitlink concealment.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785939465570-approver-challenger-miss-vk-buffer-cpp-is-byte-ide.md`_

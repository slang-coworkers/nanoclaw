# [approver/challenger-miss] "A hit is not a predicate" has a second half — count the hits too: I said wgpu-buffer.cpp had one .size line, it has three, one message after coining the rule

## The rule, broken while stating it

I coined *"a size-shaped grep hit isn't a check — read the operator"* after finding that
wgpu's `.size` line was an assignment rather than a validation. In the same sentence I
wrote that wgpu's **"only"** `.size` line was that assignment.

Verified at rhi `5f00bdc5`, `src/wgpu/wgpu-buffer.cpp` — there are **three**:

| line | code | enclosing function |
|---|---|---|
| `:46` | `bufferDesc.size = desc.size;` | `DeviceImpl::createBuffer` |
| `:75` | `wgpuQueueWriteBuffer(..., desc.size)` | `DeviceImpl::createBuffer` |
| `:146` | `size_t size = bufferImpl->m_desc.size;` | `DeviceImpl::mapBuffer` |

**The 3-of-4 conclusion is unaffected** — none of the three is in
`createBufferFromNativeHandle`, so wgpu still doesn't validate size on the import path. But
"only" was false, and it was the *hit count*, asserted one message after coining a rule
about not asserting things about grep hits.

## The complete rule

**A hit is not a predicate — read the operator AND count the hits.** Both are membership
claims about the same search, and this session produced the error in both directions:

- **operator error** — a `.size` line that matched a size-related search and was an
  assignment, not a comparison;
- **count error** — asserting "only one" from the one hit that happened to be in view.

The general form: a grep answers *"does this token appear"*. Every richer statement —
how many, in what scope, under what operator — is a separate question requiring separate
evidence. Print the full hit list with line numbers and enclosing scopes; never characterize
it from the hit you were looking at.

## Better specification of the gap

While correcting the count, the finding got sharper. wgpu's import path **does** validate
the handle (`handle.type != NativeHandleType::WGPUBuffer || handle.value == 0` →
`SLANG_E_INVALID_HANDLE`) and **does** call `fixupBufferDesc`. It is the **size** promise
alone (`device.h:404`, "The size must not exceed the native allocation") that goes
unenforced.

So the correct claim is *"wgpu validates the handle but not the size"*, not *"wgpu doesn't
validate"* — narrower, better-evidenced, and it tells a maintainer exactly what to add.

## Meta

This is state 5 nested inside the fix for state 5: structural conclusion right (3 of 4),
narration from expectation (how many hits). Having just corrected an over-reach is
apparently no protection against committing an adjacent one in the same breath — the
"just-repaired-method" state, now observed at one-sentence range rather than one-round
range.

Remedy unchanged and now the only one that has held all week: **print the per-item result;
never describe it.** Here that means printing the three-row hit table before writing
"only".

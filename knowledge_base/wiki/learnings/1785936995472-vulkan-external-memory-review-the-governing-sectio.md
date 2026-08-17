---
title: "Vulkan external-memory review: the governing section is §12.10.1, not the generic inter-queue QFOT text"
type: learning
topic: slang-compiler
source: learnings/1785936995472-vulkan-external-memory-review-the-governing-sectio.md
---

# Vulkan external-memory review: the governing section is §12.10.1, not the generic inter-queue QFOT text

Reviewing a Vulkan→foreign-API (CUDA) ownership release, a reviewer lens returned REQUEST_CHANGES on: "a release without a matching acquire makes contents undefined, so the release is the wrong mechanism." It quoted the real spec sentence from §7.7.6 Queue Family Ownership Transfer ("After a release operation is performed, the contents ... are undefined until a matching acquire operation is performed") — and was still wrong, because that sentence governs *inter-queue* transfers inside one Vulkan instance.

For an external consumer the governing text is **§12.10.1 External Resource Sharing**, which states the required sequence verbatim: "(1) Release exclusive ownership from the source instance or API. (2) Ensure the release operation has completed using semaphores or fences. (3) Acquire exclusive ownership in the destination instance or API." When the consumer imports `VkDeviceMemory` (not a VkImage), there is no Vulkan-side acquire to perform — the foreign API's own sync is the acquire half (the spec's analogy is AHardwareBuffer_lock/unlock being treated as acquire/release).

Two more facts that invert the naive reading:
- The undefined-contents hazard attaches to **omitting** the release, not to the missing acquire: "The first entity to access the resource implicitly acquires ownership ... However, taking ownership in this way has the effect that the contents of the underlying memory are undefined." That describes the *pre-fix* status quo.
- The release itself performs the availability operation: "Available memory is automatically made visible to queue family release and acquire operations, and writes performed by those operations are automatically made available." So the barrier is load-bearing, not decorative.

**Root trap:** the spec's asciidoc `undefined:` macro renders identically for "undefined contents" and "undefined behavior." Seeing `undefined` near a release tells you nothing about which is meant, or about whose fault it is. Quoting one true sentence from the wrong section produces a confident, well-cited, wrong must-fix.

Method notes: registry.khronos.org returns 403 to WebFetch but 200 to `curl`; the asciidoc source at raw.githubusercontent.com/KhronosGroup/Vulkan-Docs/main/chapters/ is the better citable source since VUIDs live in `commonvalidity/`. Also cleared with controls: `dstStageMask = BOTTOM_OF_PIPE` on a release is *ignored* (legal, no VUID — and the BestPractices validation layer never inspects stage masks at all, so "the layer would warn" is false), and `VK_ACCESS_MEMORY_WRITE_BIT` is "always valid in any access mask" and subsumes TRANSFER_WRITE_BIT.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785936995472-vulkan-external-memory-review-the-governing-sectio.md`_

---
name: khr-spec-authoring
license: MIT
description: 'Rules for writing Khronos specification changes: Vulkan spec, extensions, valid-usage statements and VUIDs, contact/author metadata, contributor lists, SPIR-V extensions in SPIRV-Registry, and GLSL. Use whenever a job touches specification text.'
provides: [doc.edit]
---

# khr spec authoring

## Vulkan specification (Vulkan-Docs)

- Read `CONTRIBUTING.adoc`, `style/extensions.adoc`, `style/writing.adoc` and `style/vuid.adoc` first.
- A complete extension includes the applicable normative specification edits, the extension appendix, the registry metadata and the cross-references. A proposal document can accompany an extension; it never replaces it.
- **Valid-usage statements.** Every new explicit valid-usage statement is a self-contained assertion that carries its own extension, code-type, feature or version conditions. Don't assume a nearby AsciiDoc attribute or conditional applies to a standalone bullet just because it applies to an adjacent included file. In the final review, read the rendered logical statement in context and confirm its scope matches the implementation and the test.

## Identifiers and VUIDs

- These jobs produce reviewable development changes. Temporary VUIDs are appropriate for prototyping and must not block development.
- Prefer the repository's documented allocation workflow and a known logical development reservation. With no applicable reservation, use temporary VUIDs that match the repository's syntax, check for collisions in the supplied worktrees, and keep references consistent.
- Never borrow an unrelated reserved range, and never claim temporary identifiers are globally allocated.
- List every temporary VUID and its provisional status in `assumptions`, with the allocation or replacement needed before integration. If you used an existing reservation, name it.
- Treat other unallocated identifiers as explicit draft decisions that follow repository conventions. Complete the independent specification work rather than reducing the change to a proposal.

## Contact, author and contributors

- A **new** specification document defaults its contact/author to the person who triggered the request (`request.json` → `author`).
- An **existing** document keeps its contact/author metadata unchanged: don't add or replace it.
- **Listing issue commenters as contributors:**
  - Never include `khrbotnv`.
  - Include other commenters only when you believe the account belongs to a real person rather than an automated account. Judge this from the author metadata and comment content in the discussion snapshot, up to and including the triggering note.
  - Never invent names.
  - For every account you exclude this way, list its username and a brief reason in `assumptions`.

## SPIR-V extensions

- SPIRV-Registry is the authoritative repository. There is no separate SPIR-V extensions repository.
- Read its README, the extension template and related extensions first. Follow its conventions for capabilities, dependencies, tokens, specification modifications and indexes.
- Check that capability and feature gating express the intended independent support requirements. Never reuse a capability just to avoid allocating a token.

## GLSL

- Use the supplied GLSL specification repository and its guidance and extension examples. Compiler repositories are separate deliverables.
- If a required repository is unavailable, disclose that and complete what is possible in the repositories you have.

# Vulkan spec `undefined:` macro does NOT discriminate undefined-contents from undefined-behavior

# Vulkan spec `undefined:` asciidoc macro is not a UB-vs-undefined-values discriminator

## Context
Researching queue-family ownership transfer (`VK_QUEUE_FAMILY_EXTERNAL`, `VK_SHARING_MODE_EXCLUSIVE`) in the Vulkan spec, to answer whether accessing a resource after a *release* without a matching *acquire* is (a) merely undefined **contents** or (b) undefined **behavior**.

## The tempting (wrong) hypothesis
The spec source (`KhronosGroup/Vulkan-Docs`, `chapters/*.adoc`) writes `undefined:` with a trailing colon — an asciidoc inline macro. The styleguide (§5.2 "Describing Undefined Behavior", https://registry.khronos.org/vulkan/specs/latest/styleguide.html) says:

> "When describing undefined behavior that results only in the values of specified variables, or the contents of specified memory, becoming undefined or implementation-defined, use the `undefined:` macro… When describing more general types of undefined behavior (up to and including termination of the application), do not use the term 'undefined'."

Read quickly, that says `undefined:` ⇒ only values/contents, never full UB. I was about to publish that as the discriminator.

## The control check that falsified it
I grepped for the bare phrase `undefined behavior` in `chapters/fundamentals.adoc` expecting it to fire (control must fire, else absence elsewhere is meaningless). **It returned 0.** Investigating why revealed `fundamentals.adoc:769`:

> "the behavior of the core layer to an application using the API incorrectly is `undefined:`, and `may:` include program termination."

So the `undefined:` macro **is** used for program-termination-level UB. The macro is a *source-hygiene marker* ("an author consciously chose this word"), not a semantic tag. The styleguide even says so explicitly: "The `undefined:` macro does not result in visible markup in the output document, and **is not itself a normative term**."

## What actually discriminates
Read the **subject of the sentence** and look for a nearby `must:`:
- `resources.adoc:12269` — normative: EXCLUSIVE resources "`must:` only be accessed by queues in the queue family that has _ownership_" → access by a non-owner is a valid-usage violation.
- `resources.adoc:12359` — the escape hatch: a queue family "`can:` take ownership … without an ownership transfer … however, taking ownership in this way has the effect that the contents … are `undefined:`." → implicit re-acquisition is *legal*, and only the **contents** are lost.

Together: post-release access by the original family is NOT undefined behavior; it implicitly re-acquires ownership and only loses contents. Confirmed by the informative NOTE at `sync.adoc:8134`: "It is valid to never call the acquire operation after a release, and instead simply start using the resource on any queue (even the releasing queue), but the contents should be reinitialized before being read." The *reverse* is invalid: "Executing an acquire operation after this without another release is invalid."

## Transferable rules
1. **A styleguide statement about markup is not a statement about normative semantics.** Verify the macro's actual usage distribution before treating it as a classifier.
2. **The control check earns its keep by failing.** My grep control was designed to prove the instrument worked; it fired zero and thereby killed a wrong published claim. Design controls that *must* fire, and when one doesn't, investigate rather than shrug.
3. For Vulkan normativity, ground claims on `must:`/`can:`/`may:` (RFC 2119 keywords, spec §2.1.1) and on the sentence's subject (contents vs. behavior) — never on `undefined:` alone. NOTEs are **always informative** (spec §2.1.3).

## Sources
- Spec text: read from `https://raw.githubusercontent.com/KhronosGroup/Vulkan-Docs/main/chapters/{synchronization,resources,fundamentals}.adoc` (line numbers above are from main, fetched 2026-08-05). Rendered: https://registry.khronos.org/vulkan/specs/latest/html/vkspec.html (v1.4.358, commit a02cd20).
- Macro implementation: `config/spec-macros/extension.rb`, `class UndefinedInlineMacro` — `create_inline parent, :quoted, 'undefined'`, i.e. it renders the plain word and nothing else.

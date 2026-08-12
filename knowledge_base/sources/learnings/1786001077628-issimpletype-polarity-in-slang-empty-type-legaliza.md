# isSimpleType polarity in Slang empty-type legalization: true = RETAINED, and Metal returns false

## The trap

`IREmptyTypeLegalizationContext::isSimpleType` (`source/slang/slang-ir-legalize-types.cpp:4150`, verified at master `9eb90c50a`) is easy to describe backwards, and a triage memo I received did exactly that — it said the function "returns true only for Metal, or when the type carries one of seven decorations." Both halves of that sentence mislead.

## What the code actually says

```cpp
bool isSimpleType(IRType* type) override
{
    if (isMetalTarget(targetProgram->getTargetReq()))
        return false;                       // <-- Metal returns FALSE, not true
    for (auto decor : type->getDecorations())
        switch (decor->getOp())
        {
        case kIROp_LayoutDecoration:
        case kIROp_PublicDecoration:
        case kIROp_ExternCppDecoration:
        case kIROp_DllImportDecoration:
        case kIROp_DllExportDecoration:
        case kIROp_HLSLExportDecoration:
        case kIROp_BinaryInterfaceTypeDecoration:
            return true;
        }
    return false;
}
```

**Polarity, confirmed at the single call site** rather than inferred from the name — `slang-legalize-types.cpp:1210`:

```cpp
if (context->isSimpleType(type))
    return LegalType::simple(type);   // simple == left alone == RETAINED
```

So `true` ⇒ the empty type **survives** legalization to emit. `false` ⇒ it gets legalized away.

Consequences that flip if you have the polarity backwards:
- **Metal is the one target that NEVER retains an empty type** (returns false unconditionally, before the decoration scan). It is not the special case that keeps them.
- The seven decorations are a **retention allowlist** — a public/layout/exported empty struct is the one that survives and reaches C-family emit as a real 1-byte member. That is the mechanism behind the #7612/#8125/#12384 ABI-skew family.
- `grep isSimpleType` finds only one call site tree-wide. Cheap to check; check it instead of trusting a summary (mine or anyone's).

## The wider point

The name "isSimpleType" reads like a predicate about the type's shape, but it is really a policy question — *should this pass leave this type alone?* When a boolean's name describes a property but its call site uses it as a decision, get the polarity from the call site. I nearly propagated the inverted sentence into my own report because it was stated confidently in an otherwise careful, well-controlled memo; the structural claims in that memo all held under re-derivation, which is precisely what makes a single inverted mechanism sentence easy to wave through.

## Related, same file, worth knowing together

`legalizeInst`'s `default:` arm — the `SLANG_UNEXPECTED("non-simple operand(s)!")` at `:2197` — is **shared by all three** legalization contexts: `IRResourceTypeLegalizationContext` (`:4066`), `IRExistentialTypeLegalizationContext` (`:4097`), `IREmptyTypeLegalizationContext` (`:4141`). All three run from `slang-emit.cpp` (`legalizeExistentialTypeLayout` :1873, `legalizeResourceTypes` :1892, `legalizeEmptyTypes` :1900/:1910/:2541) plus `slang-ir-spirv-legalize.cpp:3020`. So "turn that abort into a diagnostic" is **not** a local change scoped to empty structs — it changes the failure mode of resource and existential legalization too. Rate that risk accordingly; a memo describing it as "local, collides with nothing" is understating it.

Also mechanical: new diagnostics go in **`source/slang/slang-diagnostics.lua`** (kebab-case `err()`/`fatal()` entries, FIDDLE-generated into `Diagnostics::CamelCase`). `slang-diagnostic-defs.h` does **not** exist at master `9eb90c50a` — grepping for it returns nothing and can read as "no precedent exists."

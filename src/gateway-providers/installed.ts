/**
 * The barrel overlays append their gateway provider's registration to — one
 * appended `import './x.js';` and one `registerGatewayProvider(...)` call in
 * the imported file, the same shape as the driver barrel (`drivers/installed.ts`)
 * and the provider container-config barrel. Nothing outside this directory is
 * rewritten to install a gateway.
 */

// This fork carries OneCLI in core rather than installing it from
// `/add-onecli`, so the registration that an install would append is committed
// here. Without this line the file is a comment-only barrel, nothing calls
// `registerGatewayProvider`, and `configuredGatewayProviderKind()` throws
// `No gateway provider is registered in this build` at startup — the host
// refuses to boot. See `installed-registration.test.ts`, which is source-level
// precisely because `src/test-setup.ts` forces a fixture provider into the
// registry for every test and would otherwise mask this.
import './onecli.js';

/**
 * Credential collection MCP tool.
 *
 * trigger_credential_collection sends a card to the user and blocks until the
 * host reports back whether the credential was saved, rejected, or failed.
 * The credential value NEVER enters agent context — the user submits it into
 * a modal whose value is consumed entirely on the host side, and the host
 * only writes back a status string.
 */
import { findCredentialResponse, markCompleted } from '../db/messages-in.js';
import { writeMessageOut } from '../db/messages-out.js';
import type { McpToolDefinition } from './types.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

function generateId(): string {
  return `cred-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const triggerCredentialCollection: McpToolDefinition = {
  tool: {
    name: 'trigger_credential_collection',
    description:
      'Collect a credential (API key, token, etc.) from the user for a third-party service. Research the service first so you can pass the correct host pattern, header name, and value format. A card is sent to the user with a button that opens a secure input modal — the value is inserted directly into OneCLI and never enters your context. Blocks until the user saves, rejects, or the request fails.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Display name for the secret (e.g. "Resend API Key").',
        },
        type: {
          type: 'string',
          enum: ['generic', 'anthropic'],
          description:
            "Secret type. Use 'generic' for most third-party APIs; 'anthropic' is reserved for Anthropic API keys.",
        },
        hostPattern: {
          type: 'string',
          description:
            'Host pattern to match (e.g. "api.resend.com"). Used by OneCLI to know when to inject this credential.',
        },
        pathPattern: {
          type: 'string',
          description: 'Optional path pattern to match (e.g. "/v1/*").',
        },
        headerName: {
          type: 'string',
          description: 'Header name to inject the credential into (e.g. "Authorization"). Required for generic type.',
        },
        valueFormat: {
          type: 'string',
          description:
            'Value format template. Use {value} as the placeholder. Example: "Bearer {value}". Defaults to "{value}".',
        },
        description: {
          type: 'string',
          description: 'User-facing explanation shown on the card and in the input modal.',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (default: 600).',
        },
      },
      required: ['name', 'hostPattern'],
    },
  },
  async handler(args) {
    const name = args.name as string;
    const type = ((args.type as string) || 'generic') as 'generic' | 'anthropic';
    const hostPattern = args.hostPattern as string;
    const pathPattern = (args.pathPattern as string) || '';
    const headerName = (args.headerName as string) || '';
    const valueFormat = (args.valueFormat as string) || '';
    const description = (args.description as string) || '';
    const timeoutMs = ((args.timeout as number) || 600) * 1000;

    if (!name || !hostPattern) return err('name and hostPattern are required');

    const credentialId = generateId();
    writeMessageOut({
      id: credentialId,
      kind: 'system',
      content: JSON.stringify({
        action: 'request_credential',
        credentialId,
        name,
        type,
        hostPattern,
        pathPattern,
        headerName,
        valueFormat,
        description,
      }),
    });

    log(`trigger_credential_collection: ${credentialId} → ${name} (${hostPattern})`);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const response = findCredentialResponse(credentialId);
      if (response) {
        const parsed = JSON.parse(response.content) as {
          status: 'saved' | 'rejected' | 'failed';
          detail?: string;
        };
        markCompleted([response.id]);
        log(`trigger_credential_collection result: ${credentialId} → ${parsed.status}`);
        if (parsed.status === 'saved') return ok(parsed.detail || 'Credential saved.');
        if (parsed.status === 'rejected') return err(parsed.detail || 'Credential request rejected.');
        return err(parsed.detail || 'Credential request failed.');
      }
      await sleep(1000);
    }

    log(`trigger_credential_collection timeout: ${credentialId}`);
    return err(`Credential request timed out after ${timeoutMs / 1000}s`);
  },
};

export const credentialTools: McpToolDefinition[] = [triggerCredentialCollection];

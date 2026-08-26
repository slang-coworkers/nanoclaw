/**
 * `create_agent` delivery-action bodies.
 *
 * SECURITY: `create_agent` writes to the CENTRAL DB (agent_groups,
 * container_configs, agent_destinations) and scaffolds host filesystem state —
 * a privileged operation a confined container is otherwise architecturally
 * barred from. The container's MCP tool gate is inside the (untrusted)
 * container and is trivially bypassed by writing the outbound system row
 * directly, so authorization MUST be enforced host-side: the delivery
 * registry wraps this action with the guard, whose `agents.create` decision
 * (./guard.ts) is the old cli_scope branch verbatim — trusted global-scope
 * groups allow, everything else (including unknown config, fail-closed)
 * holds for admin approval. On approve the continuation re-enters the
 * wrapped action with the approval row as its grant and `createAgent` runs.
 * `performCreateAgent` is the module-private body.
 *
 * Lego additions (nv-main): spawns the new agent group, wires bidirectional
 * agent_destinations rows, projects the new destination into the parent's
 * running container, validates coworker_type against the coworker-types
 * registry, applies the instruction_overlay parameter, and wires the new
 * coworker into the conversation that created it. These are threaded through
 * the full create_agent `content` object into `performCreateAgent`.
 */
import fs from 'fs';
import path from 'path';

import { readCoworkerTypes, readSkillCatalog } from '../../claude-composer.js';
import { GROUPS_DIR } from '../../config.js';
import { createAgentGroup, getAgentGroup, getAgentGroupByFolder } from '../../db/agent-groups.js';
import {
  createMessagingGroup,
  getMessagingGroup,
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
  createMessagingGroupAgent,
} from '../../db/messaging-groups.js';
import { getContainerConfig } from '../../db/container-configs.js';
import { getSession } from '../../db/sessions.js';
import { wakeContainer } from '../../container-runner.js';
import { groupFolderExistsOnDisk } from '../../group-folder.js';
import { initGroupFilesystem } from '../../group-init.js';
import { PERSONA_PREPEND_FILE } from '../../group-persona.js';
import { isValidGroupFolder } from '../../group-folder.js';
import { log } from '../../log.js';
import { writeSessionMessage } from '../../session-manager.js';
import type { AgentGroup, Session } from '../../types.js';
import {
  allocateDestinationName,
  createDestination,
  getDestinationByName,
  normalizeName,
} from './db/agent-destinations.js';
import { requestApproval } from '../approvals/index.js';
import { writeDestinations } from './write-destinations.js';

async function notifyAgent(session: Session, text: string): Promise<void> {
  await writeSessionMessage(session.agent_group_id, session.id, {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    // System notification — channelType='system' / platformId=null so the
    // formatter renders <system-notification> and the routing layer can
    // never resolve self as an a2a destination.
    platformId: null,
    channelType: 'system',
    threadId: null,
    content: JSON.stringify({ text, sender: 'system', senderId: 'system' }),
  });
  const fresh = await getSession(session.id);
  if (fresh) await wakeContainer(fresh);
}

/** Guard precheck: malformed requests are answered without ever creating a hold. */
export async function validateCreateAgent(content: Record<string, unknown>, session: Session): Promise<boolean> {
  const name = typeof content.name === 'string' ? content.name : '';
  if (!name) {
    await notifyAgent(session, 'create_agent failed: name is required.');
    return false;
  }
  if (!(await getAgentGroup(session.agent_group_id))) {
    await notifyAgent(session, 'create_agent failed: source agent group not found.');
    log.warn('create_agent failed: missing source group', { sessionAgentGroup: session.agent_group_id, name });
    return false;
  }
  return true;
}

/** Guard hold: card the requesting group's admin chain. */
export async function requestCreateAgentHold(content: Record<string, unknown>, session: Session): Promise<void> {
  const name = typeof content.name === 'string' ? content.name : '';
  const instructions = typeof content.instructions === 'string' ? content.instructions : null;
  const sourceGroup = await getAgentGroup(session.agent_group_id);
  if (!sourceGroup) return;

  // Carry the full create_agent params (coworkerType, overlays, agentProvider,
  // instructionOverlay, allowedMcpTools, routing, internalOnly, …) through the
  // approval so the approved replay reconstructs the identical request: the
  // guard re-enters createAgent with this payload as its `content`.
  await requestApproval({
    session,
    agentName: sourceGroup.name,
    action: 'create_agent',
    payload: { ...content, name, instructions },
    title: `Create agent: ${name}`,
    question: `Agent "${sourceGroup.name}" wants to create a new sub-agent "${name}" (a new agent group with its own workspace and container). Approve?`,
  });
}

export interface CreateAgentOptions {
  /**
   * Suppress the terminal `Agent "<name>" created…` success notify. Error
   * notifies (collision, invalid path) still fire. For wrappers whose own
   * completion text is the requester's only "done" signal — e.g.
   * slack-agent-flow, where Slack provisioning runs AFTER this returns and
   * relaying the upstream text would report "done" ~a minute early.
   */
  suppressCreatedNotify?: boolean;
}

/** Guard allow body: performs the creation (fresh global-scope call or approved replay). */
export async function createAgent(
  content: Record<string, unknown>,
  session: Session,
  options?: CreateAgentOptions,
): Promise<void> {
  const name = typeof content.name === 'string' ? content.name : '';
  const instructions = typeof content.instructions === 'string' ? content.instructions : null;
  const sourceGroup = await getAgentGroup(session.agent_group_id);
  if (!name || !sourceGroup) return; // precheck already answered the requester

  // Thread the full `content` so the lego params (coworkerType, overlays,
  // instructionOverlay, agentProvider, allowedMcpTools, routing, internalOnly)
  // reach performCreateAgent. On an approved replay `content` is the stored
  // hold payload, so those params survive the approval round-trip.
  await performCreateAgent(
    name,
    instructions,
    content,
    session,
    sourceGroup,
    (text) => notifyAgent(session, text),
    options,
  );
}

/**
 * Core creation: writes the new agent group + bidirectional destinations and
 * scaffolds its filesystem, then reports via `notify`. Authorization is the
 * CALLER's responsibility (the guard's agents.create decision) — never call
 * this from an unauthorized path, as it performs privileged central-DB
 * writes a confined container is
 * otherwise barred from.
 */
async function performCreateAgent(
  name: string,
  instructions: string | null,
  content: Record<string, unknown>,
  session: Session,
  sourceGroup: AgentGroup,
  notify: (text: string) => Promise<void>,
  options?: CreateAgentOptions,
): Promise<void> {
  const localName = normalizeName(name);

  // Collision in the creator's destination namespace
  if (await getDestinationByName(sourceGroup.id, localName)) {
    await notify(`Cannot create agent "${name}": you already have a destination named "${localName}".`);
    return;
  }

  // Derive a safe folder name, deduplicated globally across
  // agent_groups.folder AND the on-disk groups/ dir: a folder present on disk
  // with no claiming DB row is deleted-group residue, and adopting it would
  // silently re-scope the old group's data under the new agent's identity —
  // skip to the next suffix instead (templates/create-agent.ts precedent).
  // Routed through isValidGroupFolder so reserved names (main/global/shared/
  // templates) and pattern violations are rejected at the single source of truth.
  let folder = localName;
  if (!isValidGroupFolder(folder)) {
    // normalizeName can produce reserved names (e.g. name: "Main" → "main").
    // Prefix with `coworker-` to push them out of the reserved set; the
    // collision loop below dedupes from there.
    folder = `coworker-${folder}`;
    if (!isValidGroupFolder(folder)) {
      await notifyAgent(session, `Cannot create agent "${name}": derived folder "${folder}" is invalid.`);
      log.error('create_agent: invalid derived folder', { name, localName, folder });
      return;
    }
  }
  // baseFolder, not localName: `folder` may already have been rewritten to
  // `coworker-<localName>` above, and suffixing localName would reintroduce the
  // reserved name isValidGroupFolder just rejected.
  const baseFolder = folder;
  let suffix = 2;
  while ((await getAgentGroupByFolder(folder)) || groupFolderExistsOnDisk(folder)) {
    folder = `${baseFolder}-${suffix}`;
    suffix++;
  }

  const groupPath = path.join(GROUPS_DIR, folder);
  const resolvedPath = path.resolve(groupPath);
  const resolvedGroupsDir = path.resolve(GROUPS_DIR);
  if (!resolvedPath.startsWith(resolvedGroupsDir + path.sep)) {
    await notify(`Cannot create agent "${name}": invalid folder path.`);
    log.error('create_agent path traversal attempt', { folder, resolvedPath });
    return;
  }

  const agentGroupId = `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Validate coworker_type against the registry (lego coworker system).
  // If no type requested, infer the best leaf type from the registry.
  const requestedCoworkerType =
    typeof content.coworkerType === 'string' && content.coworkerType.trim() ? content.coworkerType.trim() : null;
  let coworkerType = requestedCoworkerType;
  let creationNote: string | null = null;

  if (!requestedCoworkerType) {
    // List available leaf types so the creation note tells the caller what's available
    const knownTypes = readCoworkerTypes();
    const SKIP = new Set(['main', 'base-common']);
    const leafTypes = Object.keys(knownTypes).filter(
      (name) => !SKIP.has(name) && !(knownTypes[name] as Record<string, unknown>).flat,
    );
    if (leafTypes.length > 0) {
      creationNote = `No coworkerType specified — created as untyped (default leaf type, base spine only). Available typed options: ${leafTypes.filter((t) => t !== 'default').join(', ')}. To get project-specific skills, traits, and MCP tools, recreate with a coworkerType.`;
      log.info('create_agent: no coworkerType, available types', { leafTypes });
    }
  }

  if (requestedCoworkerType) {
    const knownTypes = readCoworkerTypes();
    const roles = requestedCoworkerType
      .split('+')
      .map((role) => role.trim())
      .filter(Boolean);
    const unknownRoles = roles.filter((role) => !knownTypes[role]);
    const looksLikePlaceholder =
      requestedCoworkerType.includes('coworker-types.json') ||
      requestedCoworkerType.includes('<') ||
      requestedCoworkerType.includes('>');
    if (looksLikePlaceholder || unknownRoles.length > 0) {
      coworkerType = null;
      creationNote = looksLikePlaceholder
        ? `Requested coworkerType "${requestedCoworkerType}" looked like a placeholder, so the agent was created as untyped.`
        : `Requested coworkerType "${requestedCoworkerType}" is not in the coworker type registry (container/{spines,skills}/*/coworker-types.yaml), so the agent was created as untyped.`;
      log.warn('create_agent falling back to untyped coworker', {
        requestedCoworkerType,
        unknownRoles,
        looksLikePlaceholder,
      });
    }
  }

  // Validate overlay names against the catalog
  let validatedOverlays: string[] | null = null;
  if (Array.isArray(content.overlays) && content.overlays.length > 0) {
    const catalog = readSkillCatalog();
    const invalid = (content.overlays as string[]).filter((n) => {
      const entry = catalog[n];
      return !entry || entry.type !== 'overlay';
    });
    if (invalid.length > 0) {
      await notifyAgent(session, `create_agent warning: unknown overlay(s) ${invalid.join(', ')} — skipped.`);
      validatedOverlays = (content.overlays as string[]).filter((n) => !invalid.includes(n));
    } else {
      validatedOverlays = content.overlays as string[];
    }
    if (validatedOverlays.length === 0) validatedOverlays = null;
  }

  const internalOnly = content.internalOnly === true;
  const directChannel = !internalOnly;
  // Dashboard sidebar grouping: create_agent's `group` scopes the coworker in
  // the dashboard sidebar — "prod" (or absent) is the shared group, any other
  // value (e.g. "dashboard:user1") is a per-user sub-group. Threaded through
  // `content` like the other lego params so the nv-dashboard overlay composes
  // cleanly instead of re-plumbing this call.
  const rawGroup = typeof content.group === 'string' ? content.group : null;
  const sidebarGroup = rawGroup && rawGroup !== 'prod' ? rawGroup : null;
  const newGroup: AgentGroup = {
    id: agentGroupId,
    name,
    folder,
    is_admin: 0,
    agent_provider: (content.agentProvider as string) || null,
    container_config: null,
    coworker_type: coworkerType,
    allowed_mcp_tools: content.allowedMcpTools
      ? JSON.stringify((content.allowedMcpTools as string[]).filter((t) => t.startsWith('mcp__')))
      : null,
    overlays: validatedOverlays ? JSON.stringify(validatedOverlays) : null,
    routing: (content.routing as string) || (directChannel ? 'direct' : 'internal'),
    disable_overlays: 0,
    paused: 0,
    sidebar_group: sidebarGroup,
    created_at: now,
  };
  await createAgentGroup(newGroup);

  // A subagent inherits its creator's EFFECTIVE provider so a single-provider
  // install (e.g. codex-only, where claude isn't authenticated) never spawns a
  // child on a runtime it can't reach. The operator can flip a child later with
  // `ncl groups config update --provider`.
  //
  // NOTE (upstream-sync): took upstream's ONE-STEP provider stamp. The child's
  // config row is fresh here (createAgentGroup just made the group; no row yet),
  // so initGroupFilesystem → ensureContainerConfig(providerHint) stamps the
  // parent's provider directly — nv-main's separate updateContainerConfigScalars
  // call was redundant with that and is dropped. We still do NOT pass
  // `instructions` here: the fork writes .instructions.md itself below (overlay +
  // seed), so passing it would double-write the seed.
  // `?? 'claude'` (not undefined): the child inherits the parent's EFFECTIVE
  // provider, so a claude parent pins the child to claude explicitly rather
  // than letting ensureContainerConfig fall back to the instance-wide
  // DEFAULT_AGENT_PROVIDER (which could be codex on a codex-default install).
  const parentProvider = (await getContainerConfig(sourceGroup.id))?.provider ?? 'claude';
  await initGroupFilesystem(newGroup, { provider: parentProvider });

  // Resolve instruction overlay — prepended to .instructions.md (the fork's
  // instruction surface; CLAUDE.md is system-composed from templates + it).
  const overlayName = (content.instructionOverlay as string) || 'thorough-analyst';
  const overlayDir = path.join(GROUPS_DIR, 'templates', 'instructions');
  const overlayPath = path.join(overlayDir, `${overlayName}.md`);
  let overlayContent = '';
  if (fs.existsSync(overlayPath)) {
    overlayContent = fs.readFileSync(overlayPath, 'utf-8').trimEnd();
  } else if (overlayName !== 'thorough-analyst') {
    log.warn('Unknown instruction overlay, falling back to thorough-analyst', { overlayName });
    const fallback = path.join(overlayDir, 'thorough-analyst.md');
    if (fs.existsSync(fallback)) {
      overlayContent = fs.readFileSync(fallback, 'utf-8').trimEnd();
    }
  }

  // Standing instructions go in instructions.prepend.md — CLAUDE.md is
  // system-composed from the spine + this file on every container wake. Writing
  // the legacy `.instructions.md` here would just make the child's first spawn
  // migrate it (see readStandingInstructions in container-runner.ts).
  const parts: string[] = [];
  if (overlayContent) parts.push(overlayContent);
  if (instructions) parts.push(instructions);
  if (parts.length > 0) {
    fs.writeFileSync(path.join(groupPath, PERSONA_PREPEND_FILE), parts.join('\n\n'));
  }

  // Insert bidirectional destination rows (= ACL grants).
  // Creator refers to child by the name it chose; child refers to creator as "parent".
  await createDestination({
    agent_group_id: sourceGroup.id,
    local_name: localName,
    target_type: 'agent',
    target_id: agentGroupId,
    created_at: now,
  });
  // Handle the unlikely case where the child already has a "parent" destination
  // (shouldn't happen for a brand-new agent, but be safe).
  let parentName = 'parent';
  let parentSuffix = 2;
  while (await getDestinationByName(agentGroupId, parentName)) {
    parentName = `parent-${parentSuffix}`;
    parentSuffix++;
  }
  await createDestination({
    agent_group_id: agentGroupId,
    local_name: parentName,
    target_type: 'agent',
    target_id: sourceGroup.id,
    created_at: now,
  });

  // Wire the new coworker into the conversation that created it (not all
  // admin channels). This scopes coworkers to the channel where they were
  // requested — they don't leak into unrelated channels.
  const mg = session.messaging_group_id ? await getMessagingGroup(session.messaging_group_id) : null;
  if (mg) {
    const existing = await getMessagingGroupAgents(mg.id);
    const alreadyWired = existing.some((a) => a.agent_group_id === agentGroupId);
    if (!alreadyWired) {
      // Use engage_mode columns (migration 010 dropped trigger_rules/response_scope).
      // Pattern-based engage with the @localName trigger — only fires when mentioned.
      await createMessagingGroupAgent({
        id: `mga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        messaging_group_id: mg.id,
        agent_group_id: agentGroupId,
        engage_mode: 'pattern',
        engage_pattern: `@${localName}\\b`,
        sender_scope: 'all',
        ignored_message_policy: 'drop',
        session_mode: 'shared',
        priority: 0,
        created_at: now,
      } as never);
    }

    // Grant the coworker a channel destination so it can reply back.
    const destPreferredName = mg.name
      ? `${mg.name}-${mg.channel_type}`
      : `${mg.channel_type}-${mg.platform_id.slice(-8)}`;
    const destName = await allocateDestinationName(agentGroupId, destPreferredName);
    await createDestination({
      agent_group_id: agentGroupId,
      local_name: destName,
      target_type: 'channel',
      target_id: mg.id,
      created_at: now,
    });
  }

  // For direct routing: create the coworker's own dashboard channel
  if (directChannel) {
    const platformId = `dashboard:${folder}`;
    let ownMg = await getMessagingGroupByPlatform('dashboard', platformId);
    if (!ownMg) {
      const ownMgId = `mg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await createMessagingGroup({
        id: ownMgId,
        channel_type: 'dashboard',
        platform_id: platformId,
        name,
        is_group: 0,
        unknown_sender_policy: 'public',
        admin_user_id: null,
        created_at: now,
      });
      ownMg = (await getMessagingGroupByPlatform('dashboard', platformId))!;
    }
    if (ownMg) {
      const existingOwnMga = (await getMessagingGroupAgents(ownMg.id)).some((a) => a.agent_group_id === agentGroupId);
      if (!existingOwnMga) {
        await createMessagingGroupAgent({
          id: `mga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          messaging_group_id: ownMg.id,
          agent_group_id: agentGroupId,
          engage_mode: 'always',
          engage_pattern: `@${name.replace(/\s+/g, '')}`,
          sender_scope: 'all',
          ignored_message_policy: 'drop',
          session_mode: 'shared',
          priority: 0,
          created_at: now,
        } as never);
      }
      const ownDestName = await allocateDestinationName(agentGroupId, `${folder}-dashboard`);
      await createDestination({
        agent_group_id: agentGroupId,
        local_name: ownDestName,
        target_type: 'channel',
        target_id: ownMg.id,
        created_at: now,
      });
    }
  }

  // REQUIRED: project the new destination into the running container's
  // inbound.db. See the top-of-file invariant in db/agent-destinations.ts
  // — forgetting this causes "dropped: unknown destination" when the parent
  // tries to send to the newly-created child.
  await writeDestinations(session.agent_group_id, session.id);

  // Refresh channel adapters so they learn about the new coworker's
  // trigger rules without requiring a restart.
  try {
    const { refreshAdapterConversations } = await import('../../index.js');
    await refreshAdapterConversations();
  } catch (refreshErr) {
    log.warn('Failed to refresh adapter conversations after create_agent', { err: refreshErr });
  }

  // Notify the creator (global-scope allow) or the approver (approved replay)
  // via the caller-supplied notify callback.
  if (!options?.suppressCreatedNotify) {
    await notify(
      `Agent "${localName}" created. You can now message it with <message to="${localName}">...</message>.${creationNote ? `\n${creationNote}` : ''}`,
    );
  }
  log.info('Agent group created', { agentGroupId, name, localName, folder, parent: sourceGroup.id });
}

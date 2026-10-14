// src/lib/workflow.ts
import prisma from "./prisma";

export interface ApprovalLevel {
  level: number;
  role: string;
  roleLabel: string | null;
  isFinal: boolean;
}

export interface WorkflowConfig {
  requestType: string;
  levels: ApprovalLevel[];
}

const DEFAULT_WORKFLOW_CONFIG: Record<string, WorkflowConfig> = {
  NEW_VM: {
    requestType: "NEW_VM",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  CLONE_VM: {
    requestType: "CLONE_VM",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  K8S_NAMESPACE: {
    requestType: "K8S_NAMESPACE",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  CUSTOMIZED: {
    requestType: "CUSTOMIZED",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  DECOMMISSION: {
    requestType: "DECOMMISSION",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: true },
      { level: 2, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  RENEWAL: {
    requestType: "RENEWAL",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  SYSTEM_UPGRADE: {
    requestType: "SYSTEM_UPGRADE",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  VPN_ACCESS: {
    requestType: "VPN_ACCESS",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  HORIZON_ACCESS: {
    requestType: "HORIZON_ACCESS",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
};

const CACHE_TTL = 5 * 60 * 1000;

let configCache: { data: Record<string, WorkflowConfig>; timestamp: number } | null = null;

async function fetchWorkflowFromDb(requestType: string): Promise<WorkflowConfig | null> {
  try {
    const workflows = await prisma.approvalWorkflow.findMany({
      where: { requestType },
      orderBy: { level: "asc" },
    });

    if (workflows.length === 0) {
      return null;
    }

    return {
      requestType,
      levels: workflows.map((w: any) => ({
        level: w.level,
        role: w.role,
        roleLabel: w.roleLabel,
        isFinal: w.isFinal,
      })),
    };
  } catch (error) {
    console.error("Error fetching workflow from DB:", error);
    return null;
  }
}

export async function getWorkflowConfig(requestType: string): Promise<WorkflowConfig> {
  const now = Date.now();

  if (configCache && now - configCache.timestamp < CACHE_TTL && configCache.data[requestType]) {
    return configCache.data[requestType];
  }

  const dbWorkflow = await fetchWorkflowFromDb(requestType);

  if (dbWorkflow) {
    if (configCache && now - configCache.timestamp < CACHE_TTL) {
      configCache.data[requestType] = dbWorkflow;
    } else {
      configCache = { data: { [requestType]: dbWorkflow }, timestamp: now };
    }
    return dbWorkflow;
  }

  return DEFAULT_WORKFLOW_CONFIG[requestType] || DEFAULT_WORKFLOW_CONFIG.NEW_VM;
}

export async function getAllWorkflowConfigs(): Promise<Record<string, WorkflowConfig>> {
  const now = Date.now();

  if (configCache && now - configCache.timestamp < CACHE_TTL && Object.keys(configCache.data).length > 1) {
    return configCache.data;
  }

  try {
    const workflows = await prisma.approvalWorkflow.findMany({
      orderBy: { level: "asc" },
    });

    if (workflows.length > 0) {
      const grouped: Record<string, WorkflowConfig> = {};

      for (const w of workflows) {
        if (!grouped[w.requestType]) {
          grouped[w.requestType] = {
            requestType: w.requestType,
            levels: [],
          };
        }
        grouped[w.requestType].levels.push({
          level: w.level,
          role: w.role,
          roleLabel: w.roleLabel,
          isFinal: w.isFinal,
        });
      }

      for (const key of Object.keys(DEFAULT_WORKFLOW_CONFIG)) {
        if (!grouped[key]) {
          grouped[key] = DEFAULT_WORKFLOW_CONFIG[key];
        }
      }

      configCache = { data: grouped, timestamp: now };
      return grouped;
    }
  } catch (error) {
    console.error("Error fetching all workflows from DB:", error);
  }

  configCache = { data: DEFAULT_WORKFLOW_CONFIG, timestamp: now };
  return DEFAULT_WORKFLOW_CONFIG;
}

export interface DynamicWorkflowLevel {
  level: number;
  role: string;
  roleLabel: string;
  statusCode: string;
  filterValue: string;
  displayName: string;
  shortName: string;
}

export function getDefaultRoleLabel(level: number, role?: string): string {
  if (role === "DC_OPS") return "DC Ops";
  if (level === 1) return "Assistant Maintenance Engineer";
  if (level === 2) return "Maintenance Engineer";
  if (level === 3) return "System Analyst";
  if (level === 4) return "DC Ops";
  return `Level ${level}`;
}

export async function getDistinctWorkflowLevels(): Promise<DynamicWorkflowLevel[]> {
  try {
    const dbWorkflows = await prisma.approvalWorkflow.findMany({
      orderBy: [{ level: "asc" }, { requestType: "asc" }],
    });

    const levelMap = new Map<number, { role: string; roleLabel: string }>();

    for (const w of dbWorkflows) {
      if (!levelMap.has(w.level)) {
        levelMap.set(w.level, {
          role: w.role,
          roleLabel: w.roleLabel || getDefaultRoleLabel(w.level, w.role),
        });
      }
    }

    if (levelMap.size === 0) {
      for (const config of Object.values(DEFAULT_WORKFLOW_CONFIG)) {
        for (const l of config.levels) {
          if (!levelMap.has(l.level)) {
            levelMap.set(l.level, {
              role: l.role,
              roleLabel: l.roleLabel || getDefaultRoleLabel(l.level, l.role),
            });
          }
        }
      }
    }

    const sortedLevels = Array.from(levelMap.entries()).sort((a, b) => a[0] - b[0]);

    return sortedLevels.map(([level, data]) => {
      const short = data.roleLabel.replace(/Assistant/i, "Asstt.");
      return {
        level,
        role: data.role,
        roleLabel: data.roleLabel,
        statusCode: `PENDING_L${level}`,
        filterValue: `PENDING_L${level}`,
        displayName: `Level ${level} - ${data.roleLabel}`,
        shortName: short,
      };
    });
  } catch (error) {
    console.error("Failed to get distinct workflow levels:", error);
    return [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", statusCode: "PENDING_L1", filterValue: "PENDING_L1", displayName: "Level 1 - Assistant Maintenance Engineer", shortName: "Asstt. Maintenance Engineer" },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", statusCode: "PENDING_L2", filterValue: "PENDING_L2", displayName: "Level 2 - Maintenance Engineer", shortName: "Maintenance Engineer" },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", statusCode: "PENDING_L3", filterValue: "PENDING_L3", displayName: "Level 3 - System Analyst", shortName: "System Analyst" },
      { level: 4, role: "DC_OPS", roleLabel: "DC Ops", statusCode: "PENDING_L4", filterValue: "PENDING_L4", displayName: "Level 4 - DC Ops", shortName: "DC Ops" },
    ];
  }
}

export async function getWorkflowLevelsForType(requestType: string): Promise<DynamicWorkflowLevel[]> {
  const config = await getWorkflowConfig(requestType);
  return config.levels.map(l => ({
    level: l.level,
    role: l.role,
    roleLabel: l.roleLabel || getDefaultRoleLabel(l.level, l.role),
    statusCode: `PENDING_L${l.level}`,
    filterValue: `PENDING_L${l.level}`,
    displayName: `Level ${l.level} - ${l.roleLabel || getDefaultRoleLabel(l.level, l.role)}`,
    shortName: (l.roleLabel || getDefaultRoleLabel(l.level, l.role)).replace(/Assistant/i, "Asstt."),
  }));
}

export async function getWorkflowLevelMap(): Promise<Record<number, string>> {
  const levels = await getDistinctWorkflowLevels();
  const map: Record<number, string> = {};
  for (const l of levels) {
    map[l.level] = l.roleLabel;
  }
  return map;
}

export async function getNextLevel(currentLevel: number, workflow: WorkflowConfig): Promise<ApprovalLevel | null> {
  const sortedLevels = [...workflow.levels].sort((a, b) => a.level - b.level);
  const nextLevel = sortedLevels.find(l => l.level > currentLevel);
  return nextLevel || null;
}

export function getLevelByRole(role: string, workflow: WorkflowConfig): ApprovalLevel | null {
  return workflow.levels.find(l => l.role === role) || null;
}

export function getLevelByLevel(level: number, workflow: WorkflowConfig): ApprovalLevel | null {
  return workflow.levels.find(l => l.level === level) || null;
}

export function getTotalLevels(workflow: WorkflowConfig): number {
  return workflow.levels.length;
}

export function canForward(level: number, workflow: WorkflowConfig): boolean {
  const currentLevel = getLevelByLevel(level, workflow);
  if (!currentLevel) return false;
  return !currentLevel.isFinal;
}

export function getStatusForLevel(level: number): string {
  return `PENDING_L${level}`;
}

export function isFinalLevel(level: number, workflow: WorkflowConfig): boolean {
  const currentLevel = getLevelByLevel(level, workflow);
  return currentLevel?.isFinal || false;
}

export function isExecutionLevel(level: number, workflow: WorkflowConfig): boolean {
  const currentLevel = getLevelByLevel(level, workflow);
  return currentLevel?.role === "DC_OPS" || false;
}

export async function createWorkflowLevel(
  requestType: string,
  level: number,
  role: string,
  roleLabel: string | null,
  isFinal: boolean
): Promise<void> {
  await prisma.approvalWorkflow.upsert({
    where: {
      requestType_level: { requestType, level },
    },
    update: { role, roleLabel, isFinal },
    create: { requestType, level, role, roleLabel, isFinal },
  });
  configCache = null;
}

export async function deleteWorkflowLevel(requestType: string, level: number): Promise<void> {
  await prisma.approvalWorkflow.delete({
    where: {
      requestType_level: { requestType, level },
    },
  });
  configCache = null;
}

export async function initializeDefaultWorkflows(): Promise<void> {
  for (const [requestType, config] of Object.entries(DEFAULT_WORKFLOW_CONFIG)) {
    for (const level of config.levels) {
      await createWorkflowLevel(
        requestType,
        level.level,
        level.role,
        level.roleLabel,
        level.isFinal
      );
    }
  }
}

export function clearWorkflowCache(): void {
  configCache = null;
}

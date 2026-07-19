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
      { level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "Director MIS", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  CLONE_VM: {
    requestType: "CLONE_VM",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "Director MIS", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  K8S_NAMESPACE: {
    requestType: "K8S_NAMESPACE",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "Director MIS", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  CUSTOMIZED: {
    requestType: "CUSTOMIZED",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "Director MIS", isFinal: true },
      { level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  DECOMMISSION: {
    requestType: "DECOMMISSION",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: true },
      { level: 2, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
    ],
  },
  RENEWAL: {
    requestType: "RENEWAL",
    levels: [
      { level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
      { level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
      { level: 3, role: "APPROVER_L3", roleLabel: "Director MIS", isFinal: true },
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
  
  if (configCache && now - configCache.timestamp < CACHE_TTL) {
    return configCache.data[requestType] || DEFAULT_WORKFLOW_CONFIG[requestType] || DEFAULT_WORKFLOW_CONFIG.NEW_VM;
  }

  const dbWorkflow = await fetchWorkflowFromDb(requestType);
  
  if (dbWorkflow) {
    configCache = { data: { [requestType]: dbWorkflow }, timestamp: now };
    return dbWorkflow;
  }

  return DEFAULT_WORKFLOW_CONFIG[requestType] || DEFAULT_WORKFLOW_CONFIG.NEW_VM;
}

export async function getAllWorkflowConfigs(): Promise<Record<string, WorkflowConfig>> {
  const now = Date.now();
  
  if (configCache && now - configCache.timestamp < CACHE_TTL) {
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
  if (level === 1) return "PENDING_L1";
  if (level === 2) return "PENDING_L2";
  if (level === 3) return "PENDING_L3";
  if (level === 4) return "PENDING_L4";
  return "PENDING_L5";
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

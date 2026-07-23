// lib/admin/workflowService.ts
import prisma from "@/lib/prisma";

export interface WorkflowLevel {
  id: string;
  requestType: string;
  level: number;
  role: string;
  roleLabel: string | null;
  isFinal: boolean;
}

export interface CreateWorkflowInput {
  requestType: string;
  level: number;
  role: string;
  roleLabel?: string;
  isFinal: boolean;
}

export interface UpdateWorkflowInput {
  role?: string;
  roleLabel?: string;
  isFinal?: boolean;
}

export async function getWorkflows(requestType?: string) {
  const where = requestType ? { requestType } : {};

  const workflows = await prisma.approvalWorkflow.findMany({
    where,
    orderBy: [{ requestType: "asc" }, { level: "asc" }],
  });

  return workflows;
}

export async function getWorkflowsByType(requestType: string) {
  return prisma.approvalWorkflow.findMany({
    where: { requestType },
    orderBy: { level: "asc" },
  });
}

export async function getWorkflowById(id: string) {
  return prisma.approvalWorkflow.findUnique({ where: { id } });
}

export async function createWorkflowLevel(input: CreateWorkflowInput) {
  const { requestType, level, role, roleLabel, isFinal } = input;

  const existing = await prisma.approvalWorkflow.findFirst({
    where: { requestType, level },
  });

  if (existing) {
    throw new Error(`Workflow level ${level} already exists for ${requestType}`);
  }

  if (isFinal) {
    await prisma.approvalWorkflow.updateMany({
      where: { requestType, isFinal: true },
      data: { isFinal: false },
    });
  }

  return prisma.approvalWorkflow.create({
    data: {
      requestType,
      level,
      role,
      roleLabel,
      isFinal,
    },
  });
}

export async function updateWorkflowLevel(id: string, input: UpdateWorkflowInput) {
  const workflow = await prisma.approvalWorkflow.findUnique({ where: { id } });
  if (!workflow) throw new Error("Workflow not found");

  if (input.isFinal) {
    await prisma.approvalWorkflow.updateMany({
      where: { requestType: workflow.requestType, isFinal: true, id: { not: id } },
      data: { isFinal: false },
    });
  }

  return prisma.approvalWorkflow.update({
    where: { id },
    data: input,
  });
}

export async function deleteWorkflowLevel(id: string) {
  const workflow = await prisma.approvalWorkflow.findUnique({ where: { id } });
  if (!workflow) throw new Error("Workflow not found");

  await prisma.approvalWorkflow.delete({ where: { id } });

  const remaining = await prisma.approvalWorkflow.findMany({
    where: { requestType: workflow.requestType },
    orderBy: { level: "asc" },
  });

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].level !== i + 1) {
      await prisma.approvalWorkflow.update({
        where: { id: remaining[i].id },
        data: { level: i + 1 },
      });
    }
  }

  if (remaining.length > 0 && !remaining.some((w: any) => w.isFinal)) {
    await prisma.approvalWorkflow.update({
      where: { id: remaining[remaining.length - 1].id },
      data: { isFinal: true },
    });
  }
}

export async function reorderWorkflowLevels(requestType: string, levelIds: string[]) {
  return prisma.$transaction(
    levelIds.map((id, index) =>
      prisma.approvalWorkflow.update({
        where: { id },
        data: { level: index + 1 },
      })
    )
  );
}

export async function getRequestTypes() {
  return ["NEW_VM", "CUSTOMIZED", "DECOMMISSION", "RENEWAL"];
}

export async function getAvailableRoles() {
  return [
    { value: "APPROVER_L1", label: "Approver Level 1" },
    { value: "APPROVER_L2", label: "Approver Level 2" },
    { value: "APPROVER_L3", label: "Approver Level 3" },
    { value: "APPROVER_L4", label: "Approver Level 4" },
    { value: "DC_OPS", label: "DC Operations" },
  ];
}

export async function duplicateWorkflow(sourceRequestType: string, targetRequestType: string) {
  const sourceWorkflows = await prisma.approvalWorkflow.findMany({
    where: { requestType: sourceRequestType },
    orderBy: { level: "asc" },
  });

  await prisma.approvalWorkflow.deleteMany({
    where: { requestType: targetRequestType },
  });

  return prisma.$transaction(
    sourceWorkflows.map((w: any) =>
      prisma.approvalWorkflow.create({
        data: {
          requestType: targetRequestType,
          level: w.level,
          role: w.role,
          roleLabel: w.roleLabel,
          isFinal: w.isFinal,
        },
      })
    )
  );
}

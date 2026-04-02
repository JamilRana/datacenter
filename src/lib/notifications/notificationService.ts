// lib/notifications/notificationService.ts
import prisma from "@/lib/prisma";
import * as emailService from "@/lib/admin/emailService";

export type NotificationType = 
  | "REQUEST_SUBMITTED"
  | "APPROVAL_REQUIRED"
  | "REQUEST_APPROVED"
  | "REQUEST_REJECTED"
  | "VM_PROVISIONED"
  | "VM_EXPIRY_WARNING"
  | "LICENSE_EXPIRY_WARNING"
  | "GENERAL";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  requestId?: string;
  userId?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

class NotificationService {
  private async createInAppNotification(userId: string, payload: NotificationPayload) {
    return prisma.notification.create({
      data: {
        userId,
        type: payload.type,
        message: payload.message,
      },
    });
  }

  private async notifyMultipleUsers(userIds: string[], payload: NotificationPayload) {
    if (userIds.length === 0) return;
    
    const notifications = userIds.map(userId => ({
      userId,
      type: payload.type,
      message: payload.message,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });
  }

  async notifyByRole(role: string, payload: NotificationPayload) {
    const users = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: { name: role },
          },
        },
        isActive: true,
      },
      select: { id: true, email: true },
    });

    const userIds = users.map(u => u.id);
    await this.notifyMultipleUsers(userIds, payload);

    if (payload.type === "APPROVAL_REQUIRED") {
      const emails = users.map(u => u.email).filter(Boolean);
      await Promise.allSettled(
        emails.map(email => 
          this.sendApprovalEmail(email!, payload)
        )
      );
    }
  }

  async notifyUser(userId: string, payload: NotificationPayload) {
    await this.createInAppNotification(userId, payload);

    if (payload.type === "REQUEST_APPROVED" || 
        payload.type === "REQUEST_REJECTED" || 
        payload.type === "VM_PROVISIONED" ||
        payload.type === "VM_EXPIRY_WARNING") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      
      if (user?.email) {
        await this.sendStatusEmail(user.email, payload);
      }
    }
  }

  async notifyRequester(requestId: string, status: "APPROVED" | "REJECTED" | "PROVISIONED") {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    if (!request || !request.requester) return;

    const payload: NotificationPayload = {
      type: status === "APPROVED" ? "REQUEST_APPROVED" : 
           status === "REJECTED" ? "REQUEST_REJECTED" : "VM_PROVISIONED",
      title: `Request ${status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Provisioned"}`,
      message: `Your request "${request.systemName}" has been ${status.toLowerCase()}.`,
      link: `/requests/${request.id}`,
      requestId: request.id,
    };

    await this.notifyUser(request.requester.id, payload);
  }

  async notifyNextApprovers(requestId: string, nextLevel: number) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { requestType: true, systemName: true },
    });

    if (!request) return;

    const workflow = await prisma.approvalWorkflow.findFirst({
      where: {
        requestType: request.requestType,
        level: nextLevel,
      },
      select: { role: true },
    });

    if (!workflow) return;

    const approverRole = workflow.role;
    
    const payload: NotificationPayload = {
      type: "APPROVAL_REQUIRED",
      title: `Approval Required - Level ${nextLevel}`,
      message: `New request "${request.systemName}" requires your approval.`,
      link: `/approvals/${requestId}`,
      requestId: requestId,
    };

    await this.notifyByRole(approverRole, payload);
  }

  async notifyDCOps(requestId: string) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { systemName: true, requester: { select: { name: true } } },
    });

    if (!request) return;

    const payload: NotificationPayload = {
      type: "APPROVAL_REQUIRED",
      title: "Execution Required",
      message: `Request "${request.systemName}" approved. Ready for provisioning.`,
      link: `/inventory/vms`,
      requestId: requestId,
    };

    await this.notifyByRole("DC_OPS", payload);
  }

  async notifyVMExpiry(vmId: string, daysUntilExpiry: number) {
    const vm = await prisma.vmInstance.findUnique({
      where: { id: vmId },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        request: { 
          select: { 
            alternativePersonEmail: true,
            alternativePersonName: true,
          } 
        },
      },
    });

    if (!vm || !vm.owner) return;

    const payload: NotificationPayload = {
      type: "VM_EXPIRY_WARNING",
      title: "VM Expiry Warning",
      message: `Your VM "${vm.hostname}" will expire in ${daysUntilExpiry} days.`,
      link: `/inventory/vms`,
    };

    const userIds = [vm.owner.id];
    const emails = [vm.owner.email];

    if (vm.request?.alternativePersonEmail) {
      emails.push(vm.request.alternativePersonEmail);
    }

    await this.notifyMultipleUsers(userIds, payload);

    await Promise.allSettled(
      emails.filter(Boolean).map(email => 
        this.sendVMExpiryEmail(email!, vm.hostname || "Unknown", daysUntilExpiry)
      )
    );
  }

  async notifyLicenseExpiry(licenseId: string, daysUntilExpiry: number) {
    const license = await prisma.softwareLicense.findUnique({
      where: { id: licenseId },
      select: { name: true },
    });

    if (!license) return;

    const payload: NotificationPayload = {
      type: "LICENSE_EXPIRY_WARNING",
      title: "License Expiry Warning",
      message: `License "${license.name}" will expire in ${daysUntilExpiry} days.`,
      link: `/inventory/licenses`,
    };

    await this.notifyByRole("ADMIN", payload);

    const adminUsers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: { name: "ADMIN" },
          },
        },
        isActive: true,
      },
      select: { email: true },
    });

    await Promise.allSettled(
      adminUsers.map(u => u.email).filter(Boolean).map(email =>
        this.sendLicenseExpiryEmail(email!, license.name, daysUntilExpiry)
      )
    );
  }

  private async sendApprovalEmail(to: string, payload: NotificationPayload) {
    const subject = `Approval Required: ${payload.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Approval Request</h2>
        <p>${payload.message}</p>
        ${payload.link ? `<p><a href="${process.env.NEXT_PUBLIC_APP_URL}${payload.link}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Request</a></p>` : ""}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated notification from VM Management System.</p>
      </div>
    `;

    await emailService.sendEmail(to, subject, html);
  }

  private async sendStatusEmail(to: string, payload: NotificationPayload) {
    const isApproved = payload.type === "REQUEST_APPROVED";
    const subject = `Request ${isApproved ? "Approved" : "Rejected"}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isApproved ? "#16a34a" : "#dc2626"};">Request ${isApproved ? "Approved" : "Rejected"}</h2>
        <p>${payload.message}</p>
        ${payload.link ? `<p><a href="${process.env.NEXT_PUBLIC_APP_URL}${payload.link}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Details</a></p>` : ""}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated notification from VM Management System.</p>
      </div>
    `;

    await emailService.sendEmail(to, subject, html);
  }

  private async sendVMExpiryEmail(to: string, hostname: string, days: number) {
    const subject = `VM Expiry Warning - ${hostname}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">VM Expiry Warning</h2>
        <p>Your virtual machine <strong>${hostname}</strong> will expire in <strong>${days} days</strong>.</p>
        <p>Please renew your request to avoid service interruption.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/requests" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Renew Request</a></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated notification from VM Management System.</p>
      </div>
    `;

    await emailService.sendEmail(to, subject, html);
  }

  private async sendLicenseExpiryEmail(to: string, licenseName: string, days: number) {
    const subject = `License Expiry Warning - ${licenseName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">License Expiry Warning</h2>
        <p>The license <strong>${licenseName}</strong> will expire in <strong>${days} days</strong>.</p>
        <p>Please renew the license to avoid compliance issues.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/inventory/licenses" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Licenses</a></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated notification from VM Management System.</p>
      </div>
    `;

    await emailService.sendEmail(to, subject, html);
  }
}

export const notificationService = new NotificationService();

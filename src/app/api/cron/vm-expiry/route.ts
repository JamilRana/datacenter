import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as emailService from "@/lib/admin/emailService";
import { getAppUrl } from "@/lib/utils";

/**
 * Weekly cron endpoint to check for VM renewal expiry
 * Notifies VM owners and developers 30 days before VM renewal date
 * 
 * Recommended schedule: Every Monday at 9:00 AM
 */

export async function GET() {
  try {
    // Check VMs expiring within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringVMs = await prisma.vmInstance.findMany({
      where: {
        renewalDate: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
        status: "ACTIVE",
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
        request: {
          include: {
            developer: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    if (expiringVMs.length === 0) {
      return NextResponse.json({ message: "No VMs expiring within 30 days", processed: 0 });
    }

    const processedVMs: string[] = [];

    for (const vm of expiringVMs) {
      const daysUntilExpiry = Math.ceil(
        (vm.renewalDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      const vmName = vm.hostname || vm.systemName || "Unknown VM";
      // Construct a unique signature for this VM renewal period
      const uniqueSignature = `VM ID: ${vm.id}, Renewal Date: ${vm.renewalDate?.toISOString()}`;

      // 1. Idempotency Check: check if the owner was already notified of this renewal date
      const ownerNotified = vm.owner ? await prisma.notification.findFirst({
        where: {
          userId: vm.owner.id,
          type: "VM_EXPIRY_WARNING",
          message: { contains: uniqueSignature },
        },
      }) : null;

      if (vm.owner && ownerNotified) {
        // Skip since it was already processed for this renewal period
        continue;
      }

      // Compile recipients for this VM (owner and developer)
      const recipients: { id: string; email: string | null; name: string; isDeveloper: boolean }[] = [];
      
      if (vm.owner) {
        recipients.push({
          id: vm.owner.id,
          email: vm.owner.email,
          name: vm.owner.name,
          isDeveloper: false,
        });
      }

      const developer = vm.request?.developer;
      if (developer) {
        recipients.push({
          id: developer.id,
          email: developer.email,
          name: developer.name,
          isDeveloper: true,
        });
      }

      const appUrl = getAppUrl();
      const subject = `VM Renewal Reminder - ${vmName}`;

      for (const recipient of recipients) {
        if (!recipient.email) continue;

        // Verify again with recipient-specific check to be completely safe
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: recipient.id,
            type: "VM_EXPIRY_WARNING",
            message: { contains: uniqueSignature },
          },
        });

        if (existingNotification) {
          continue;
        }

        // Create in-app notification with uniqueSignature in message
        await prisma.notification.create({
          data: {
            userId: recipient.id,
            type: "VM_EXPIRY_WARNING",
            message: `Reminder: VM "${vmName}" is due for renewal on ${vm.renewalDate?.toLocaleDateString()}. (${uniqueSignature})`,
            link: "/inventory/vms",
          },
        });

        // Send email notification
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">VM Renewal Reminder</h2>
            <p>Dear ${recipient.name || "User"},</p>
            <p>${recipient.isDeveloper ? "The VM associated with a request you developed" : "Your VM"} is due for renewal:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>VM Hostname</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${vmName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Renewal Date</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${vm.renewalDate?.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Until Renewal</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; color: #f59e0b; font-weight: bold;">${daysUntilExpiry} days</td>
              </tr>
            </table>
            ${recipient.isDeveloper ? `<p>Please coordinate with the VM owner regarding renewal.</p>` : `<p>Please submit a renewal request to continue using this VM.</p>`}
            <p><a href="${appUrl}/inventory/vms" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View VMs</a></p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">This is an automated notification from VM Management System.</p>
          </div>
        `;

        await emailService.sendEmail(recipient.email, subject, html);
      }

      // Guest developer notification (email only)
      if (!developer && vm.request?.developerEmail) {
        const devEmail = vm.request.developerEmail;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">VM Renewal Reminder</h2>
            <p>Dear ${vm.request.developerName || "Developer"},</p>
            <p>The VM associated with a request you developed is due for renewal:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>VM Hostname</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${vmName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Renewal Date</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${vm.renewalDate?.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Until Renewal</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; color: #f59e0b; font-weight: bold;">${daysUntilExpiry} days</td>
              </tr>
            </table>
            <p>Please coordinate with the VM owner regarding renewal.</p>
            <p><a href="${appUrl}/inventory/vms" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View VMs</a></p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">This is an automated notification from VM Management System.</p>
          </div>
        `;
        await emailService.sendEmail(devEmail, subject, html);
      }

      processedVMs.push(vm.id);
    }

    return NextResponse.json({
      message: `Processed ${processedVMs.length} expiring VMs`,
      processed: processedVMs.length,
    });
  } catch (error) {
    console.error("VM expiry cron error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

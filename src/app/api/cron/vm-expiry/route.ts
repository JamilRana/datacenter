import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as emailService from "@/lib/admin/emailService";

/**
 * Weekly cron endpoint to check for VM renewal expiry
 * Notifies VM owners, ADMIN, and DC_OPS 30 days before VM renewal date
 * 
 * HOW TO RUN WEEKLY:
 * 1. External cron service (cron.org, easycron.com): GET /api/cron/vm-expiry
 * 2. Windows Task Scheduler: Create weekly task calling this URL
 * 3. Linux cron: 0 9 * * 1 curl -s https://yourdomain.com/api/cron/vm-expiry
 * 
 * Recommended schedule: Every Monday at 9:00 AM
 */

export async function GET() {
  try {
    // Check VMs expiring within 30 days (since we run weekly)
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
      },
    });

    if (expiringVMs.length === 0) {
      return NextResponse.json({ message: "No VMs expiring within 30 days", processed: 0 });
    }

    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: { name: "ADMIN" },
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    const dcops = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: { name: "DC_OPS" },
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    const staffUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: { name: "REQUESTER" },
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    const allRecipients = [...admins, ...dcops, ...staffUsers];
    const uniqueRecipients = allRecipients.filter(
      (user, index, self) => index === self.findIndex((u) => u.email === user.email)
    );

    // Check last 7 days to avoid duplicate weekly notifications
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const processedVMs: string[] = [];

    for (const vm of expiringVMs) {
      const daysUntilExpiry = Math.ceil(
        (vm.renewalDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      const vmName = vm.hostname || vm.subdomain || "Unknown VM";
      const notificationMessage = `VM "${vmName}" renewal due in ${daysUntilExpiry} days.`;

      for (const recipient of uniqueRecipients) {
        if (!recipient.email) continue;

        // Skip if this recipient is the owner (they get a different message)
        const isOwner = vm.owner?.id === recipient.id;

        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: recipient.id,
            type: "VM_EXPIRY_WARNING",
            message: { contains: vmName },
            createdAt: { gte: sevenDaysAgo },
          },
        });

        if (existingNotification) {
          continue;
        }

        await prisma.notification.create({
          data: {
            userId: recipient.id,
            type: "VM_EXPIRY_WARNING",
            message: notificationMessage,
            link: "/inventory/vms",
          },
        });

        const subject = isOwner
          ? `VM Renewal Reminder - ${vmName}`
          : `VM Expiry Warning - ${vmName}`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">${isOwner ? "VM Renewal Reminder" : "VM Expiry Warning"}</h2>
            <p>Dear ${recipient.name || "User"},</p>
            <p>${isOwner ? "Your VM" : "The following VM"} is due for renewal:</p>
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
            ${isOwner ? `<p>Please submit a renewal request to continue using this VM.</p>` : `<p>Please coordinate with the VM owner for renewal.</p>`}
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/inventory/vms" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View VMs</a></p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">This is an automated notification from VM Management System.</p>
          </div>
        `;

        await emailService.sendEmail(recipient.email, subject, html);
      }

      processedVMs.push(vm.id);
    }

    return NextResponse.json({
      message: `Processed ${processedVMs.length} expiring VMs`,
      processed: processedVMs.length,
      recipients: uniqueRecipients.length,
    });
  } catch (error) {
    console.error("VM expiry cron error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

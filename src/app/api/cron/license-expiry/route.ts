import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as emailService from "@/lib/admin/emailService";

/**
 * Weekly cron endpoint to check for expiring licenses
 * Notifies ADMIN and DC_OPS users 30 days before license expiry
 * 
 * HOW TO RUN WEEKLY:
 * 1. External cron service (cron.org, easycron.com): GET /api/cron/license-expiry
 * 2. Windows Task Scheduler: Create weekly task calling this URL
 * 3. Linux cron: 0 9 * * 1 curl -s https://yourdomain.com/api/cron/license-expiry
 * 
 * Recommended schedule: Every Monday at 9:00 AM
 */

export async function GET() {
  try {
    // Check licenses expiring within 30 days (since we run weekly)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringLicenses = await prisma.softwareLicense.findMany({
      where: {
        expiryDate: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        vendor: true,
        expiryDate: true,
      },
    });

    if (expiringLicenses.length === 0) {
      return NextResponse.json({ message: "No licenses expiring within 30 days", processed: 0 });
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

    const notificationRecipients = [...admins, ...dcops];
    const uniqueRecipients = notificationRecipients.filter(
      (user, index, self) => index === self.findIndex((u) => u.email === user.email)
    );

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Check last 7 days to avoid duplicate weekly notifications
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const processedLicenses: string[] = [];

    for (const license of expiringLicenses) {
      const daysUntilExpiry = Math.ceil(
        (license.expiryDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      for (const recipient of uniqueRecipients) {
        if (!recipient.email) continue;

        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: recipient.id,
            type: "LICENSE_EXPIRY_WARNING",
            message: { contains: license.name },
            createdAt: { gte: sevenDaysAgo },
          },
        });

        if (existingNotification) {
          continue;
        }

        await prisma.notification.create({
          data: {
            userId: recipient.id,
            type: "LICENSE_EXPIRY_WARNING",
            message: `License "${license.name}" (${license.vendor}) will expire in ${daysUntilExpiry} days.`,
            link: "/inventory/licenses",
          },
        });

        const subject = `License Expiry Warning - ${license.name}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">License Expiry Warning</h2>
            <p>Dear ${recipient.name || "Admin"},</p>
            <p>The following license is expiring soon:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>License Name</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${license.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Vendor</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${license.vendor}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Expiry Date</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${license.expiryDate?.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Until Expiry</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; color: #dc2626; font-weight: bold;">${daysUntilExpiry} days</td>
              </tr>
            </table>
            <p>Please renew the license to avoid compliance issues.</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/inventory/licenses" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Licenses</a></p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">This is an automated notification from VM Management System.</p>
          </div>
        `;

        await emailService.sendEmail(recipient.email, subject, html);
      }

      processedLicenses.push(license.id);
    }

    return NextResponse.json({
      message: `Processed ${processedLicenses.length} expiring licenses`,
      processed: processedLicenses.length,
      recipients: uniqueRecipients.length,
    });
  } catch (error) {
    console.error("License expiry cron error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

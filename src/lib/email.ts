// src/lib/email.ts
import { env } from "process";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FROM_EMAIL = "noreply@vmcloud.local";
const PORTAL_URL = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export interface EmailParams {
  to: string;
  subject: string;
  body: string;
}

function getHtmlTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">VMCloud Portal</h1>
                <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Infrastructure Request Management</p>
              </td>
            </tr>
            
            <!-- Content -->
            <tr>
              <td style="padding: 40px 30px;">
                ${content}
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="padding: 20px 30px; background-color: #f1f5f9; border-radius: 0 0 12px 12px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">
                  This is an automated notification from VMCloud Portal.
                </p>
                <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 11px;">
                  Please do not reply to this email. Access the portal to manage your requests.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export function getApprovalEmailHtml(
  recipientName: string,
  systemName: string,
  status: string,
  level: number,
  comments?: string
): string {
  const statusColors: Record<string, string> = {
    PENDING_L1: "#f59e0b",
    PENDING_L2: "#f59e0b", 
    PENDING_L3: "#f59e0b",
    APPROVED: "#10b981",
    REJECTED: "#ef4444",
    RETURNED: "#8b5cf6",
  };
  
  const statusColor = statusColors[status] || "#64748b";

  let content = `
    <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">Hello ${recipientName},</h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
      A request requires your approval in the VMCloud Portal.
    </p>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 120px;">System Name:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${systemName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Status:</td>
          <td style="padding: 8px 0;">
            <span style="background-color: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
              ${status.replace(/_/g, " ")}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Approval Level:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">Level ${level}</td>
        </tr>
      </table>
    </div>
  `;

  if (comments) {
    content += `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0; color: #92400e; font-size: 13px; font-weight: 600;">Comments:</p>
        <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${comments}</p>
      </div>
    `;
  }

  content += `
    <a href="${PORTAL_URL}/approvals" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 20px;">
      Review in Portal
    </a>
  `;

  return getHtmlTemplate(content, "Approval Required");
}

export function getStatusUpdateEmailHtml(
  recipientName: string,
  systemName: string,
  newStatus: string,
  comments?: string
): string {
  const statusInfo: Record<string, { color: string; message: string }> = {
    APPROVED: { color: "#10b981", message: "Your request has been approved!" },
    REJECTED: { color: "#ef4444", message: "Your request has been rejected." },
    RETURNED: { color: "#8b5cf6", message: "Your request has been returned for changes." },
    PROVISIONED: { color: "#3b82f6", message: "Your VM has been provisioned!" },
    PENDING_L1: { color: "#f59e0b", message: "Your request is pending approval." },
  };

  const info = statusInfo[newStatus] || { color: "#64748b", message: `Status changed to ${newStatus}` };

  let content = `
    <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">Hello ${recipientName},</h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
      ${info.message}
    </p>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 120px;">System Name:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${systemName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">New Status:</td>
          <td style="padding: 8px 0;">
            <span style="background-color: ${info.color}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
              ${newStatus.replace(/_/g, " ")}
            </span>
          </td>
        </tr>
      </table>
    </div>
  `;

  if (comments) {
    content += `
      <div style="background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px; font-weight: 600;">Message from Approver:</p>
        <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6;">${comments}</p>
      </div>
    `;
  }

  const actionUrl = newStatus === "REJECTED" || newStatus === "RETURNED" 
    ? `${PORTAL_URL}/requests` 
    : `${PORTAL_URL}/requests`;

  content += `
    <a href="${actionUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 20px;">
      View Details
    </a>
  `;

  return getHtmlTemplate(content, `Request ${newStatus.replace(/_/g, " ")} - ${systemName}`);
}

export function getExecutionEmailHtml(
  recipientName: string,
  systemName: string,
  vmDetails?: { ip?: string; hostname?: string }
): string {
  let content = `
    <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">Hello ${recipientName},</h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
      Great news! Your VM has been successfully provisioned and is now ready for use.
    </p>
    
    <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #a7f3d0;">
      <h3 style="margin: 0 0 16px 0; color: #065f46; font-size: 16px; font-weight: 600;">VM Details</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0; color: #047857; font-size: 13px; width: 120px;">Hostname:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${vmDetails?.hostname || systemName}</td>
        </tr>
        ${vmDetails?.ip ? `
        <tr>
          <td style="padding: 8px 0; color: #047857; font-size: 13px;">IP Address:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-family: monospace;">${vmDetails.ip}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <p style="margin: 20px 0; color: #64748b; font-size: 13px;">
      You can now access and manage your VM through the inventory section.
    </p>
  `;

  content += `
    <a href="${PORTAL_URL}/inventory/vms" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 20px;">
      View in Inventory
    </a>
  `;

  return getHtmlTemplate(content, "VM Provisioned - Ready to Use");
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Stub for actual email sending - integrate with SendGrid, AWS SES, etc.
  console.log("=== EMAIL NOTIFICATION ===");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Preview: ${html.substring(0, 200)}...`);
  console.log("==========================");
  
  // TODO: Implement actual email sending
  // Example with SendGrid:
  // await sgMail.send({ to, from: FROM_EMAIL, subject, html });
  
  return true;
}

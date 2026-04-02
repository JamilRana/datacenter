// src/lib/email.ts


import { env } from "node:process";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import crypto from "crypto";

const DEFAULT_PORTAL_URL = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const DEFAULT_FROM_EMAIL = env.NEXT_PUBLIC_EMAIL || "[EMAIL_ADDRESS]";

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || "default-32-char-encryption-key!!";

function decryptSmtpPassword(text: string): string {
  try {
    const parts = text.split(":");
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    const key = Buffer.from(ENCRYPTION_KEY, "utf-8");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return text;
  }
}

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string; // Plain text fallback
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Escape HTML special characters to prevent XSS in email content
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Fetch SMTP configuration from system settings
 */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { category: "smtp" },
    });

    console.log("SMTP settings from DB:", settings.map(s => ({ key: s.key, value: s.isSecret ? "***" : s.value })));

    const configMap: Record<string, string> = {};
    settings.forEach((s) => {
      configMap[s.key] = s.key === "smtp_password" ? decryptSmtpPassword(s.value) : s.value;
    });

    // Validate required fields - check both smtp_user and smtp_email for compatibility
    if (!configMap.smtp_host || !configMap.smtp_port || (!configMap.smtp_user && !configMap.smtp_email)) {
      console.warn("SMTP configuration incomplete");
      return null;
    }

    return {
      host: configMap.smtp_host,
      port: parseInt(configMap.smtp_port, 10),
      secure: configMap.smtp_secure === "true",
      auth: {
        user: configMap.smtp_email || configMap.smtp_user || "",
        pass: configMap.smtp_password || "",
      },
      from: configMap.smtp_from || configMap.smtp_email || DEFAULT_FROM_EMAIL,
    };
  } catch (error) {
    console.error("Failed to fetch SMTP config:", error);
    return null;
  }
}

/**
 * Create reusable email HTML template with consistent branding
 */
function getEmailTemplate(content: string, title: string): string {
  const escapedTitle = escapeHtml(title);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <!--[if mso]>
  <style>
    table { border-collapse: collapse; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">MIS DC Portal</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Infrastructure Request Management</p>
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
            <td style="padding: 20px 30px; background-color: #f1f5f9; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                This is an automated notification from MIS DC Portal.
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

/**
 * Generate approval request email HTML
 */
export function getApprovalEmailHtml(
  recipientName: string,
  systemName: string,
  status: string,
  level: number,
  comments?: string
): string {
  const escapedName = escapeHtml(recipientName);
  const escapedSystem = escapeHtml(systemName);
  const escapedComments = comments ? escapeHtml(comments) : null;

  const statusColors: Record<string, string> = {
    PENDING_L1: "#f59e0b",
    PENDING_L2: "#f59e0b", 
    PENDING_L3: "#f59e0b",
    APPROVED: "#10b981",
    REJECTED: "#ef4444",
    RETURNED: "#8b5cf6",
  };
  
  const statusColor = statusColors[status] || "#64748b";
  const displayStatus = status.replace(/_/g, " ");

  let content = `
    <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">Hello ${escapedName},</h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
      A request requires your approval in the MIS DC Portal.
    </p>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 120px;">System Name:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${escapedSystem}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Status:</td>
          <td style="padding: 8px 0;">
            <span style="background-color: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block;">
              ${displayStatus}
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

  if (escapedComments) {
    content += `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0; color: #92400e; font-size: 13px; font-weight: 600;">Comments:</p>
        <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${escapedComments}</p>
      </div>
    `;
  }

  const portalUrl = `${DEFAULT_PORTAL_URL}/approvals`;
  content += `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
      <tr>
        <td>
          <a href="${portalUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
            Review in Portal
          </a>
        </td>
      </tr>
    </table>
  `;

  return getEmailTemplate(content, "Approval Required");
}

/**
 * Generate status update email HTML
 */
export function getStatusUpdateEmailHtml(
  recipientName: string,
  systemName: string,
  newStatus: string,
  comments?: string
): string {
  const escapedName = escapeHtml(recipientName);
  const escapedSystem = escapeHtml(systemName);
  const escapedComments = comments ? escapeHtml(comments) : null;

  const statusInfo: Record<string, { color: string; message: string }> = {
    APPROVED: { color: "#10b981", message: "Your request has been approved!" },
    REJECTED: { color: "#ef4444", message: "Your request has been rejected." },
    RETURNED: { color: "#8b5cf6", message: "Your request has been returned for changes." },
    PROVISIONED: { color: "#3b82f6", message: "Your VM has been provisioned!" },
    PENDING_L1: { color: "#f59e0b", message: "Your request is pending approval." },
  };

  const info = statusInfo[newStatus] || { 
    color: "#64748b", 
    message: `Status changed to ${newStatus.replace(/_/g, " ")}` 
  };
  const displayStatus = newStatus.replace(/_/g, " ");

  let content = `
    <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">Hello ${escapedName},</h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
      ${info.message}
    </p>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 120px;">System Name:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${escapedSystem}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">New Status:</td>
          <td style="padding: 8px 0;">
            <span style="background-color: ${info.color}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block;">
              ${displayStatus}
            </span>
          </td>
        </tr>
      </table>
    </div>
  `;

  if (escapedComments) {
    content += `
      <div style="background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px; font-weight: 600;">Message:</p>
        <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6;">${escapedComments}</p>
      </div>
    `;
  }

  const actionUrl = `${DEFAULT_PORTAL_URL}/requests`;
  content += `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
      <tr>
        <td>
          <a href="${actionUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
            View Details
          </a>
        </td>
      </tr>
    </table>
  `;

  return getEmailTemplate(content, `Request ${displayStatus} - ${escapedSystem}`);
}

/**
 * Generate VM execution/provisioning email HTML
 */
export function getExecutionEmailHtml(
  recipientName: string,
  systemName: string,
  vmDetails?: { ip?: string; hostname?: string }
): string {
  const escapedName = escapeHtml(recipientName);
  const escapedSystem = escapeHtml(systemName);
  const escapedHostname = vmDetails?.hostname ? escapeHtml(vmDetails.hostname) : null;
  const escapedIp = vmDetails?.ip ? escapeHtml(vmDetails.ip) : null;

  let content = `
    <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">Hello ${escapedName},</h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
      Great news! Your VM has been successfully provisioned and is now ready for use.
    </p>
    
    <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #a7f3d0;">
      <h3 style="margin: 0 0 16px 0; color: #065f46; font-size: 16px; font-weight: 600;">VM Details</h3>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding: 8px 0; color: #047857; font-size: 13px; width: 120px;">Hostname:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${escapedHostname || escapedSystem}</td>
        </tr>
        ${escapedIp ? `
        <tr>
          <td style="padding: 8px 0; color: #047857; font-size: 13px;">IP Address:</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-family: 'Courier New', monospace;">${escapedIp}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <p style="margin: 20px 0; color: #64748b; font-size: 13px;">
      You can now access and manage your VM through the inventory section.
    </p>
  `;

  const inventoryUrl = `${DEFAULT_PORTAL_URL}/inventory/vms`;
  content += `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
      <tr>
        <td>
          <a href="${inventoryUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
            View in Inventory
          </a>
        </td>
      </tr>
    </table>
  `;

  return getEmailTemplate(content, "VM Provisioned - Ready to Use");
}

/**
 * Convert HTML email to plain text fallback
 */
function htmlToText(html: string): string {
  // Basic conversion - consider using a library like 'html-to-text' for production
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500) + '...';
}

/**
 * Send email with retry logic and proper error handling
 */
export async function sendEmail(params: EmailParams): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, text } = params;

  // Validate input
  if (!to || !subject || !html) {
    return { success: false, error: "Missing required email parameters" };
  }

  // Get SMTP config from database
  const smtpConfig = await getSmtpConfig();
  console.log("SMTP Config from DB:", smtpConfig ? { host: smtpConfig.host, port: smtpConfig.port, user: smtpConfig.auth.user, from: smtpConfig.from } : null);
  
  // Fallback to environment variables if DB config not available
  const config = smtpConfig || {
    host: env.SMTP_HOST || "localhost",
    port: parseInt(env.SMTP_PORT || "587", 10),
    secure: env.SMTP_SECURE === "true",
    auth: {
      user: env.SMTP_USER || "",
      pass: env.SMTP_PASSWORD || "",
    },
    from: env.SMTP_FROM || DEFAULT_FROM_EMAIL,
  };
  
  console.log("Final SMTP Config:", { host: config.host, port: config.port, user: config.auth.user, from: config.from });

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port, 
    secure: config.secure,
    auth: config.auth.user ? config.auth : undefined,
    tls: {
      rejectUnauthorized: env.NODE_ENV === "production",
    },
  });

  const mailOptions = {
    from: config.from,
    to,
    subject,
    html,
    text: text || htmlToText(html),
  };

  // Retry logic for transient failures
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`✓ Email sent to ${to}: ${subject}`);
      return { success: true };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Email send attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      // Don't retry on authentication/configuration errors
      if (lastError.message.includes("authentication") || 
          lastError.message.includes("invalid credentials") ||
          lastError.message.includes("ENOTFOUND")) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("✗ Failed to send email after retries:", lastError?.message);
  return { 
    success: false, 
    error: lastError?.message || "Unknown email error" 
  };
}

/**
 * Helper: Send approval notification
 */
export async function sendApprovalNotification(
  to: string,
  recipientName: string,
  systemName: string,
  status: string,
  level: number,
  comments?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `Approval Required: ${systemName} (Level ${level})`;
  const html = getApprovalEmailHtml(recipientName, systemName, status, level, comments);
  
  return sendEmail({ to, subject, html });
}

/**
 * Helper: Send status update notification
 */
export async function sendStatusUpdateNotification(
  to: string,
  recipientName: string,
  systemName: string,
  newStatus: string,
  comments?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `Request ${newStatus.replace(/_/g, " ")}: ${systemName}`;
  const html = getStatusUpdateEmailHtml(recipientName, systemName, newStatus, comments);
  
  return sendEmail({ to, subject, html });
}

/**
 * Helper: Send VM provisioning notification
 */
export async function sendProvisioningNotification(
  to: string,
  recipientName: string,
  systemName: string,
  vmDetails?: { ip?: string; hostname?: string }
): Promise<{ success: boolean; error?: string }> {
  const subject = `VM Ready: ${systemName}`;
  const html = getExecutionEmailHtml(recipientName, systemName, vmDetails);
  
  return sendEmail({ to, subject, html });
}
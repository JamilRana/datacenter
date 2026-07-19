// lib/admin/emailService.ts
import prisma from "@/lib/prisma";
import { createTransport, Transporter } from "nodemailer";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || "default-32-char-encryption-key!!";

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, "utf-8");
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  try {
    const parts = text.split(":");
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

export interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  email: string;
  password: string;
  secure: boolean;
  enabled: boolean;
}

export async function getEmailSettings(): Promise<EmailSettings | null> {
  const settings = await prisma.systemSetting.findMany({
    where: { category: "smtp" },
  });

  if (settings.length === 0) return null;

  const result: Partial<EmailSettings> = { enabled: false };

  for (const s of settings) {
    switch (s.key) {
      case "smtp_host":
        result.smtpHost = s.value;
        break;
      case "smtp_port":
        result.smtpPort = parseInt(s.value, 10);
        break;
      case "smtp_email":
        result.email = s.value;
        break;
      case "smtp_password":
        result.password = decrypt(s.value);
        break;
      case "smtp_secure":
        result.secure = s.value === "true";
        break;
      case "smtp_enabled":
        result.enabled = s.value === "true";
        break;
    }
  }

  return result as EmailSettings;
}

export async function saveEmailSettings(settings: EmailSettings) {
  const smtpSettings = [
    { key: "smtp_host", value: settings.smtpHost, category: "smtp", isSecret: false },
    { key: "smtp_port", value: settings.smtpPort.toString(), category: "smtp", isSecret: false },
    { key: "smtp_email", value: settings.email, category: "smtp", isSecret: false },
    { key: "smtp_password", value: encrypt(settings.password), category: "smtp", isSecret: true },
    { key: "smtp_secure", value: settings.secure.toString(), category: "smtp", isSecret: false },
    { key: "smtp_enabled", value: settings.enabled.toString(), category: "smtp", isSecret: false },
  ];

  for (const setting of smtpSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, isSecret: setting.isSecret },
      create: setting,
    });
  }
}

export async function testEmailSettings(testEmail: string): Promise<{ success: boolean; message: string }> {
  const settings = await getEmailSettings();

  if (!settings || !settings.enabled) {
    return { success: false, message: "Email settings not configured or disabled" };
  }

  try {
    const transporter = createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.secure,
      auth: {
        user: settings.email,
        pass: settings.password,
      },
    });

    await transporter.sendMail({
      from: settings.email,
      to: testEmail,
      subject: "Test Email - VM Management System",
      text: "This is a test email from VM Management System. If you receive this, your email settings are working correctly.",
      html: "<p>This is a test email from VM Management System. If you receive this, your email settings are working correctly.</p>",
    });

    return { success: true, message: "Test email sent successfully" };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to send test email" };
  }
}

let cachedTransporter: Transporter | null = null;

export async function getTransporter(): Promise<Transporter | null> {
  const settings = await getEmailSettings();

  if (!settings || !settings.enabled) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.secure,
    auth: {
      user: settings.email,
      pass: settings.password,
    },
  });

  return cachedTransporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const settings = await getEmailSettings();

  if (!settings || !settings.enabled) {
    console.log("Email disabled or not configured");
    return false;
  }

  try {
    const transporter = await getTransporter();
    if (!transporter) return false;

    await transporter.sendMail({
      from: settings.email,
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendApprovalNotification(
  email: string,
  requestName: string,
  status: string,
  level?: number
) {
  const subject = `Request ${status}: ${requestName}`;
  const html = `
    <h2>VM Management System - Request Update</h2>
    <p>Your request <strong>${requestName}</strong> has been <strong>${status}</strong>.</p>
    ${level ? `<p>Current approval level: ${level}</p>` : ""}
    <p>Please login to the system for more details.</p>
  `;
  return sendEmail(email, subject, html);
}

export async function sendProvisioningNotification(email: string, requestName: string, vmHostname: string) {
  const subject = `VM Provisioned: ${requestName}`;
  const html = `
    <h2>VM Management System - VM Provisioned</h2>
    <p>Your request <strong>${requestName}</strong> has been provisioned.</p>
    <p>VM Hostname: <strong>${vmHostname}</strong></p>
    <p>Please login to the system to access your VM.</p>
  `;
  return sendEmail(email, subject, html);
}

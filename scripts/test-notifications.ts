// Set environment variables before any modules are loaded
process.env.APP_URL = "https://datacenter.dghs.gov.bd";
process.env.TESTING_NOTIFICATIONS = "true";

import { getAppUrl } from "@/lib/utils";
import nodemailer from "nodemailer";

// Initialize global mock variables for our mock prisma client
(global as any).mockSmtpSettings = [
  // Keys for email.ts
  { key: "SMTP_HOST", value: "smtp.mailtrap.io" },
  { key: "SMTP_PORT", value: "2525" },
  { key: "SMTP_USER", value: "user" },
  { key: "SMTP_PASSWORD", value: "pass" },
  { key: "SMTP_FROM", value: "noreply@dghs.gov.bd" },
  
  // Keys for emailService.ts (category: "smtp", lowercase keys)
  { key: "smtp_host", value: "smtp.mailtrap.io", category: "smtp" },
  { key: "smtp_port", value: "2525", category: "smtp" },
  { key: "smtp_email", value: "noreply@dghs.gov.bd", category: "smtp" },
  { key: "smtp_password", value: "pass", category: "smtp" },
  { key: "smtp_secure", value: "false", category: "smtp" },
  { key: "smtp_enabled", value: "true", category: "smtp" },
];

(global as any).mockApprovalList = [];
(global as any).mockVmList = [];
(global as any).mockLicenseList = [];
(global as any).mockUserList = [];
(global as any).mockNotificationFindFirst = () => null;

// 1. Mock nodemailer to collect all sent emails without sending them
const sentEmails: any[] = [];
nodemailer.createTransport = (() => {
  return {
    sendMail: async (mailOptions: any) => {
      sentEmails.push(mailOptions);
      return { messageId: "mock-message-id" };
    }
  };
}) as any;

// Helper to clear recorded emails
function clearSentEmails() {
  sentEmails.length = 0;
}

// 2. Test Suite
async function runTests() {
  console.log("==============================================");
  console.log("STARTING EMAIL NOTIFICATION SYSTEM TESTS");
  console.log("==============================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Import services now that environment variables are initialized
  const { NotificationService } = await import("@/lib/services/notification.service");

  // TEST 1: Base URL Configuration
  try {
    const appUrl = getAppUrl();
    assert(
      appUrl === "https://datacenter.dghs.gov.bd",
      `getAppUrl() should return the production domain configured in APP_URL (got: ${appUrl})`
    );
  } catch (err: any) {
    console.error("Test 1 failed with error:", err);
    failed++;
  }

  // TEST 2: Current Approver Recipient Selection
  try {
    clearSentEmails();

    const mockRequestId = "test-request-uuid-12345";
    const mockApproverEmail = "approver1@dghs.gov.bd";
    const mockApproverName = "Level 1 Approver";

    // Set mock approvals for this test
    (global as any).mockApprovalList = [
      {
        id: "mock-approval-1",
        level: 1,
        decision: "PENDING",
        approver: {
          id: "mock-approver-id-1",
          email: mockApproverEmail,
          name: mockApproverName,
        }
      }
    ];

    // Call notifyApprovers for Level 1
    await NotificationService.notifyApprovers(mockRequestId, "Test System", 1);

    // Verify email was sent to ONLY the assigned approver
    assert(
      sentEmails.length === 1,
      `Should send exactly one email (sent: ${sentEmails.length})`
    );
    assert(
      sentEmails[0]?.to === mockApproverEmail,
      `Should send email to the assigned approver ${mockApproverEmail} (sent to: ${sentEmails[0]?.to})`
    );
    assert(
      sentEmails[0]?.html.includes("https://datacenter.dghs.gov.bd/approvals"),
      "Email link should contain the correct production base URL: https://datacenter.dghs.gov.bd"
    );
  } catch (err: any) {
    console.error("Test 2 failed with error:", err);
    failed++;
  }

  // TEST 3: VM Expiry Reminder Idempotency
  try {
    clearSentEmails();

    const mockVmId = "test-vm-uuid-999";
    const mockRenewalDate = new Date();
    mockRenewalDate.setDate(mockRenewalDate.getDate() + 20); // expiring in 20 days

    // Mock vm instances
    (global as any).mockVmList = [
      {
        id: mockVmId,
        hostname: "test-vm-host",
        renewalDate: mockRenewalDate,
        status: "ACTIVE",
        owner: {
          id: "owner-id-1",
          email: "owner@dghs.gov.bd",
          name: "VM Owner",
        },
        request: {
          developer: {
            id: "dev-id-1",
            email: "dev@dghs.gov.bd",
            name: "VM Developer",
          }
        }
      }
    ];

    // Simulate first run where no warning has been sent
    (global as any).mockNotificationFindFirst = () => null;

    // Trigger vm-expiry GET cron logic
    const { GET: runVmExpiryCron } = await import("@/app/api/cron/vm-expiry/route");
    const response = await runVmExpiryCron();
    const data = await response.json();

    assert(
      data.processed === 1,
      `Should successfully process 1 expiring VM (processed: ${data.processed})`
    );
    assert(
      sentEmails.length === 2,
      `Should send emails to both the owner and the developer (sent: ${sentEmails.length})`
    );
    assert(
      sentEmails.some(e => e.to === "owner@dghs.gov.bd") && sentEmails.some(e => e.to === "dev@dghs.gov.bd"),
      "Emails should target owner and developer"
    );

    // Simulate second run: mock findFirst to return the warning notification
    clearSentEmails();
    (global as any).mockNotificationFindFirst = (args: any) => {
      if (args.where?.type === "VM_EXPIRY_WARNING" && args.where?.message?.contains?.includes(mockVmId)) {
        return {
          id: "existing-warning-notification",
          type: "VM_EXPIRY_WARNING",
          message: `VM ID: ${mockVmId}, Renewal Date: ${mockRenewalDate.toISOString()}`,
        };
      }
      return null;
    };

    const response2 = await runVmExpiryCron();
    const data2 = await response2.json();

    assert(
      data2.processed === 0,
      `Should skip processing on second run to prevent duplicates (processed: ${data2.processed})`
    );
    assert(
      sentEmails.length === 0,
      `Should not send any duplicate emails (sent: ${sentEmails.length})`
    );
  } catch (err: any) {
    console.error("Test 3 failed with error:", err);
    failed++;
  }

  // TEST 4: License Expiry Reminder Idempotency
  try {
    clearSentEmails();

    const mockLicenseId = "test-license-uuid-888";
    const mockExpiryDate = new Date();
    mockExpiryDate.setDate(mockExpiryDate.getDate() + 15); // expiring in 15 days

    // Mock software licenses
    (global as any).mockLicenseList = [
      {
        id: mockLicenseId,
        name: "Test OS License",
        vendor: "Microsoft",
        expiryDate: mockExpiryDate,
      }
    ];

    // Mock users
    (global as any).mockUserList = [
      { id: "admin-id-1", email: "admin@dghs.gov.bd", name: "System Admin" },
      { id: "dcops-id-1", email: "dcops@dghs.gov.bd", name: "DC Ops Staff" }
    ];

    // Simulate first run
    (global as any).mockNotificationFindFirst = () => null;

    const { GET: runLicenseExpiryCron } = await import("@/app/api/cron/license-expiry/route");
    const response = await runLicenseExpiryCron();
    const data = await response.json();

    assert(
      data.processed === 1,
      `Should successfully process 1 expiring license (processed: ${data.processed})`
    );
    assert(
      sentEmails.length === 2,
      `Should send emails to both the admin and the DC Ops staff (sent: ${sentEmails.length})`
    );

    // Simulate second run: mock findFirst to return the warning notification
    clearSentEmails();
    (global as any).mockNotificationFindFirst = (args: any) => {
      if (args.where?.type === "LICENSE_EXPIRY_WARNING" && args.where?.message?.contains?.includes(mockLicenseId)) {
        return {
          id: "existing-license-warning",
          type: "LICENSE_EXPIRY_WARNING",
          message: `License ID: ${mockLicenseId}, Expiry Date: ${mockExpiryDate.toISOString()}`,
        };
      }
      return null;
    };

    const response2 = await runLicenseExpiryCron();
    const data2 = await response2.json();

    assert(
      data2.processed === 0,
      `Should skip processing on second run to prevent duplicates (processed: ${data2.processed})`
    );
    assert(
      sentEmails.length === 0,
      `Should not send any duplicate emails (sent: ${sentEmails.length})`
    );
  } catch (err: any) {
    console.error("Test 4 failed with error:", err);
    failed++;
  }

  console.log("==============================================");
  console.log("TEST RUN COMPLETE");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("==============================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unhandled test failure:", err);
  process.exit(1);
});

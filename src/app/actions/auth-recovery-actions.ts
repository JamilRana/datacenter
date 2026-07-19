"use server";

import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { sendOtpEmail } from "@/lib/email";

/**
 * Generate a 6-digit verification OTP and send it to the user's email if they exist.
 */
export async function requestOtp(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { success: false, message: "Email is required" };
    }

    // 1. Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      return { success: false, message: "User with this email does not exist." };
    }

    if (!user.isActive) {
      return { success: false, message: "This user account is inactive." };
    }

    // 2. Generate a secure 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Clear any existing OTPs for this email and save the new one
    await prisma.passwordResetOtp.deleteMany({
      where: { email: trimmedEmail },
    });

    await prisma.passwordResetOtp.create({
      data: {
        email: trimmedEmail,
        otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Valid for 10 minutes
      },
    });

    // 4. Send email containing OTP
    const mailResult = await sendOtpEmail(trimmedEmail, user.name, otp);

    if (!mailResult.success) {
      console.error("Failed to send OTP email:", mailResult.error);
      return {
        success: false,
        message: "Failed to send OTP verification email. Please try again.",
      };
    }

    return { success: true, message: "OTP has been sent to your email address." };
  } catch (error) {
    console.error("Error in requestOtp server action:", error);
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Verify OTP and reset user's password.
 */
export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOtp = otp.trim();

    if (!trimmedEmail || !trimmedOtp || !newPassword) {
      return { success: false, message: "All fields are required" };
    }

    if (newPassword.length < 8) {
      return { success: false, message: "Password must be at least 8 characters long" };
    }

    // 1. Verify the OTP exists and has not expired
    const record = await prisma.passwordResetOtp.findFirst({
      where: {
        email: trimmedEmail,
        otp: trimmedOtp,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!record) {
      return { success: false, message: "Invalid or expired OTP. Please request a new one." };
    }

    // 2. Hash new password
    const hashedPassword = await hash(newPassword, 10);

    // 3. Update password in the database
    await prisma.user.update({
      where: { email: trimmedEmail },
      data: { password: hashedPassword },
    });

    // 4. Clean up the OTP record
    await prisma.passwordResetOtp.deleteMany({
      where: { email: trimmedEmail },
    });

    // 5. Create audit log if we can find the user ID
    try {
      const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });
      if (user) {
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "PASSWORD_RECOVERY_SUCCESS",
            entityType: "USER",
            entityId: user.id,
            details: JSON.stringify({ email: trimmedEmail }),
          },
        });
      }
    } catch (auditError) {
      console.error("Failed to create password recovery audit log:", auditError);
    }

    return { success: true, message: "Your password has been successfully reset." };
  } catch (error) {
    console.error("Error in resetPasswordWithOtp server action:", error);
    return { success: false, message: "An unexpected error occurred. Please try again." };
  }
}

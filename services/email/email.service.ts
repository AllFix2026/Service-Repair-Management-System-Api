import { prisma } from "@/db/prisma";
import { resend, FROM_EMAIL } from "@/config/email.config";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Shared Email Layout ────────────────────────────────────────────────────
function baseTemplate(content: string): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>AllFix</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">🔧 AllFix</h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Service & Repair Management System</p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding:40px;">
                ${content}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
                <p style="margin:0;color:#94a3b8;font-size:12px;">© ${new Date().getFullYear()} AllFix · Service Repair Management System</p>
                <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">This is an automated email. Please do not reply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

// ─── Password Reset Email ─────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (
  userId: string,
  email: string,
  token: string
) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  console.log("\n-------------------------------------------");
  console.log("🔐 PASSWORD RESET LINK");
  console.log(`📧 To: ${email}`);
  console.log(`🔗 Link: ${resetUrl}`);
  console.log("-------------------------------------------\n");

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:24px;font-weight:700;">Reset Your Password</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
      We received a request to reset the password for your AllFix account.<br/>
      Click the button below to set a new password. This link expires in <strong>30 minutes</strong>.
    </p>
    <div style="margin:32px 0;text-align:center;">
      <a href="${resetUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
        Reset Password
      </a>
    </div>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px 20px;margin:24px 0;">
      <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
        ⚠️ If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
      </p>
    </div>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">
      Or copy and paste this link into your browser:<br/>
      <a href="${resetUrl}" style="color:#4f46e5;word-break:break-all;">${resetUrl}</a>
    </p>
  `);

  let attempts = 0;
  let lastError: any = null;

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Reset your password — AllFix",
        html,
      });
      console.log(`✅ Password reset email sent to ${email}`);
      return;
    } catch (error: any) {
      lastError = error;
      console.error(`Password reset email attempt ${attempts} failed:`, error.message);
      if (attempts < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError;
};

// ─── Email Verification ───────────────────────────────────────────────────────
export const sendVerificationEmail = async (
  userId: string,
  email: string,
  token: string
) => {
  const verificationUrl = `${process.env.BACKEND_URL}/api/v1/users/verify-email?token=${token}`;

  console.log("\n-------------------------------------------");
  console.log("✉️  EMAIL VERIFICATION LINK");
  console.log(`📧 To: ${email}`);
  console.log(`🔗 Link: ${verificationUrl}`);
  console.log("-------------------------------------------\n");

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:24px;font-weight:700;">Verify Your Email Address</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
      Welcome to AllFix! Please verify your email address to activate your account.
    </p>
    <div style="margin:32px 0;text-align:center;">
      <a href="${verificationUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;">
        Verify Email Address
      </a>
    </div>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">
      Or copy and paste this link:<br/>
      <a href="${verificationUrl}" style="color:#4f46e5;word-break:break-all;">${verificationUrl}</a>
    </p>
  `);

  let attempts = 0;
  let lastError: any = null;

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Verify your email — AllFix",
        html,
      });
      await prisma.emailLog.create({ data: { userId, email, type: "verification", status: "SENT", attempts } });
      return;
    } catch (error: any) {
      lastError = error;
      if (attempts < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError;
};

// ─── Admin Approval Email ─────────────────────────────────────────────────────
export const sendAdminApprovalEmail = async (request: any) => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@futuracareers.tech";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const approveUrl = `${frontendUrl}/admin/approve-registration?token=${request.approvalToken}`;
  const fullData = request.fullData;

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:24px;font-weight:700;">New Shop Registration Request</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">A new shop owner has submitted a registration request. Please review the details below.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:140px;">Shop Name</td><td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${request.shopName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Owner Name</td><td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${request.ownerName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Owner Email</td><td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${request.ownerEmail}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Location</td><td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${fullData?.city || "—"}, ${fullData?.country || "—"}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Phone</td><td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${fullData?.phone || "—"}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">Plan</td><td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${fullData?.plan || "—"}</td></tr>
      </table>
    </div>
    <div style="margin:32px 0;text-align:center;">
      <a href="${approveUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;">
        Approve Registration
      </a>
    </div>
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: adminEmail,
    subject: `New Registration: ${request.shopName} — AllFix`,
    html,
  });
};

// ─── User Payment Link Email ──────────────────────────────────────────────────
export const sendUserPaymentLinkEmail = async (request: any) => {
  const paymentUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/registration/payment?requestId=${request.id}`;

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:24px;font-weight:700;">🎉 Your Registration is Approved!</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
      Great news! Your registration for <strong>${request.shopName}</strong> has been approved by our team.<br/>
      To complete your setup, please proceed to payment.
    </p>
    <div style="margin:32px 0;text-align:center;">
      <a href="${paymentUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;">
        Proceed to Payment
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">Once payment is confirmed, your account will be activated immediately.</p>
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: request.ownerEmail,
    subject: "Registration Approved — Complete Your Payment | AllFix",
    html,
  });
};

// ─── Payment Confirmation ─────────────────────────────────────────────────────
export const sendPaymentConfirmationEmail = async (
  userId: string,
  email: string,
  amount: number,
  plan: string
) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:24px;font-weight:700;">✅ Payment Confirmed!</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
      We have successfully received your payment. Your account is now active!
    </p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <p style="margin:0;color:#166534;font-size:28px;font-weight:800;">LKR ${amount.toLocaleString()}</p>
      <p style="margin:8px 0 0;color:#166534;font-size:14px;">Plan: <strong>${plan}</strong></p>
    </div>
    <p style="margin:0;color:#64748b;font-size:14px;text-align:center;">Thank you for choosing AllFix — Service Repair Management System!</p>
  `);

  let attempts = 0;
  let lastError: any = null;

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Payment Confirmed — AllFix",
        html,
      });
      await prisma.emailLog.create({ data: { userId, email, type: "payment_confirmation", status: "SENT", attempts } });
      return;
    } catch (error: any) {
      lastError = error;
      if (attempts < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  await prisma.emailLog.create({ data: { userId, email, type: "payment_confirmation", status: "FAILED", attempts, error: lastError?.message ?? "Unknown" } });
};
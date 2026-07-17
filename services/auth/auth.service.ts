import { env } from "@/config/env";
import { prisma } from "@/db/prisma";
import { randomToken, sha256Base64Url } from "@/utils/crypto.util";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/utils/jwt.util";
import bcrypt from "bcrypt";

import { sendPasswordResetEmail } from "@/services/email/email.service";
import { v4 as uuidv4 } from "uuid";

const BCRYPT_ROUNDS = 12;

type TokenUser = {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  shopId: string | null;
};

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
    default:
      return value * 24 * 60 * 60 * 1000;
  }
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function createTokensForUser(user: TokenUser) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role as any,
    tenantId: user.tenantId,
    shopId: user.shopId,
  });

  const jti = randomToken(16);
  const refreshToken = signRefreshToken({
    sub: user.id,
    jti,
  });

  const tokenHash = sha256Base64Url(refreshToken);

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash,
      tenantId: user.tenantId,
      shopId: user.shopId,
      expiresAt: new Date(Date.now() + parseExpiry(env.REFRESH_TOKEN_EXPIRY)),
    },
  });

  return { accessToken, refreshToken };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      shop: {
        select: {
          shopCode: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          country: true,
          postalCode: true,
          taxNumber: true,
          website: true
        }
      }
    },
  });

  if (!user) {
    console.log(`[AuthService] LOGIN FAILED: User not found for email: ${email}`);
    throw { status: 401, message: "Invalid credentials" };
  }

  if (!user.isActive) {
    console.log(`[AuthService] LOGIN FAILED: User is inactive: ${email}`);
    throw { status: 401, message: "Invalid credentials" };
  }

  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    console.log(`[AuthService] LOGIN FAILED: Password mismatch for user: ${email}`);
    throw { status: 401, message: "Invalid credentials" };
  }

  console.log(`[AuthService] LOGIN SUCCESS: ${email} (Role: ${user.role})`);

  const tokens = await createTokensForUser({
    id: user.id,
    email: user.email ?? email,
    role: user.role,
    tenantId: user.tenantId,
    shopId: user.shopId,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName || user.name,
      role: user.role,
      tenantId: user.tenantId,
      shopId: user.shopId,
      shopCode: (user as any).shop?.shopCode ?? null,
      shopName: (user as any).shop?.name ?? null,
      shopEmail: (user as any).shop?.email ?? null,
      shopPhone: (user as any).shop?.phone ?? null,
      shopAddress: (user as any).shop?.address ?? null,
      shopCity: (user as any).shop?.city ?? null,
      shopCountry: (user as any).shop?.country ?? null,
      shopPostalCode: (user as any).shop?.postalCode ?? null,
      shopTaxNumber: (user as any).shop?.taxNumber ?? null,
      shopWebsite: (user as any).shop?.website ?? null,
    },
    tokens,
  };
}

export async function refreshSession(refreshToken: string) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw { status: 401, message: "Invalid or expired refresh token" };
  }

  const tokenHash = sha256Base64Url(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { id: decoded.jti },
    include: {
      user: {
        include: {
          shop: {
            select: {
              shopCode: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              country: true,
              postalCode: true,
              taxNumber: true,
              website: true
            }
          }
        }
      }
    },
  });

  if (!stored || stored.tokenHash !== tokenHash || stored.revokedAt || stored.expiresAt < new Date()) {
    throw { status: 401, message: "Refresh token is no longer valid" };
  }

  const user = stored.user;
  const tokens = await createTokensForUser({
    id: user.id,
    email: user.email ?? "",
    role: user.role,
    tenantId: user.tenantId,
    shopId: user.shopId,
  });

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName || user.name || "",
      role: user.role,
      tenantId: user.tenantId,
      shopId: user.shopId,
      shopCode: user.shop?.shopCode ?? null,
      shopName: user.shop?.name ?? null,
      shopEmail: user.shop?.email ?? null,
      shopPhone: user.shop?.phone ?? null,
      shopAddress: user.shop?.address ?? null,
      shopCity: user.shop?.city ?? null,
      shopCountry: user.shop?.country ?? null,
      shopPostalCode: user.shop?.postalCode ?? null,
      shopTaxNumber: user.shop?.taxNumber ?? null,
      shopWebsite: user.shop?.website ?? null,
    },
    tokens,
  };
}

export async function logoutSession(refreshToken: string): Promise<void> {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { id: decoded.jti },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Keep logout idempotent even for invalid/expired tokens.
  }
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      shop: {
        select: {
          shopCode: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          country: true,
          postalCode: true,
          taxNumber: true,
          website: true
        }
      }
    }
  });

  if (!user) {
    throw { status: 404, message: "User not found" };
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName || user.name || "",
    role: user.role,
    tenantId: user.tenantId,
    shopId: user.shopId,
    shopCode: user.shop?.shopCode ?? null,
    shopName: user.shop?.name ?? null,
    shopEmail: user.shop?.email ?? null,
    shopPhone: user.shop?.phone ?? null,
    shopAddress: user.shop?.address ?? null,
    shopCity: user.shop?.city ?? null,
    shopCountry: user.shop?.country ?? null,
    shopPostalCode: user.shop?.postalCode ?? null,
    shopTaxNumber: user.shop?.taxNumber ?? null,
    shopWebsite: user.shop?.website ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function createInitialAdminUser(email: string, password: string, tenantName: string) {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (existingAdmin) {
    throw { status: 409, message: "Admin user already exists" };
  }

  const tenant = await prisma.tenant.create({
    data: { name: tenantName },
  });

  const passwordHash = await hashPassword(password);
  const fallbackFullName = email.split("@")[0] || tenantName;
  const user = await prisma.user.create({
    data: {
      email,
      fullName: fallbackFullName,
      password: passwordHash,
      role: "ADMIN",
      tenantId: tenant.id,
    },
    select: { id: true, email: true, role: true, tenantId: true, shopId: true, createdAt: true },
  });

  return user;
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Return early to avoid account enumeration, but don't throw error for non-existent users
    return;
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  // This endpoint is email-driven, so user.email should exist for matched rows.
  await sendPasswordResetEmail(user.id, user.email ?? email, token);
}

export async function completePasswordReset(token: string, newPassword: string) {
  const storedToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!storedToken || storedToken.used || storedToken.expiresAt < new Date()) {
    throw { status: 400, message: "Invalid or expired reset token" };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: storedToken.userId },
      data: { password: passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: storedToken.id },
      data: { used: true },
    }),
  ]);
}

export async function updateCurrentUser(userId: string, data: { fullName?: string; password?: string }) {
  const updateData: any = {};
  
  if (data.fullName) {
    updateData.fullName = data.fullName;
    updateData.name = data.fullName; // Sync both name fields if they exist
  }
  
  if (data.password) {
    updateData.password = await hashPassword(data.password);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, email: true, fullName: true, role: true, tenantId: true, shopId: true }
  });

  return user;
}

import { env } from "@/config/env";
import { prisma } from "@/db/prisma";
import type {
  RegisterStaffRequestDto,
  RegisterStaffResponseDto,
  StaffAuthContextDto,
  StaffDashboardContextDto,
  ValidateShopIdRequestDto,
  ValidateShopIdResponseDto,
} from "@/types/dto/staff.dto";
import { STAFF_ASSIGNABLE_ROLES } from "@/types/staff.types";
import { ApiError } from "@/utils/common.util";
import { signAccessToken, type JwtRole } from "@/utils/jwt.util";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import type { CreateStaffInput, UpdateStaffInput } from "@/validators/staff/staff.validator";

const BCRYPT_ROUNDS = 12;
const STAFF_SIGNATURE_TTL_MS = 5 * 60 * 1000;

function roleToLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    TECHNICIAN: "Technician",
    CUSTOMER: "Customer",
  };
  return labels[role];
}

export type StaffListRow = {
  staffId: string;
  name: string;
  role: string;
  isActive: boolean;
};

const stableStringify = (payload: Record<string, unknown>) => {
  return JSON.stringify(payload, Object.keys(payload).sort());
};

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const isValidRequestSource = (
  context: StaffAuthContextDto,
  payload?: unknown,
) => {
  if (context.request_source && context.request_source !== env.STAFF_REGISTRATION_SOURCE) {
    return false;
  }

  if (!context.request_signature || !context.request_timestamp) {
    return true; // signature is optional — source check already passed
  }

  if (!payload || typeof payload !== "object") {
    return false;
  }

  const timestamp = Number(context.request_timestamp);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  if (Math.abs(Date.now() - timestamp) > STAFF_SIGNATURE_TTL_MS) {
    return false;
  }

  const signingPayload = `${timestamp}.${stableStringify(payload as Record<string, unknown>)}`;
  const expected = crypto
    .createHmac("sha256", env.STAFF_REGISTRATION_SECRET)
    .update(signingPayload)
    .digest("hex");

  return safeEqual(expected, context.request_signature);
};

const normalizeError = (error: unknown) => {
  if (error instanceof ApiError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    const meta = (error as { meta?: { target?: string | string[] } }).meta;
    const target = Array.isArray(meta?.target) ? meta?.target : meta?.target ? [meta.target] : [];

    if (target.includes("phone")) {
      return new ApiError(409, "Phone number already registered");
    }

    if (target.includes("email")) {
      return new ApiError(409, "Email already registered");
    }

    return new ApiError(409, "Unique constraint violation");
  }

  return new ApiError(500, "Unexpected failure");
};

async function resolveStaffUserId(
  tenantId: string,
  shopId: string,
  staffIdParam: string,
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      shopId,
      role: { in: [...STAFF_ASSIGNABLE_ROLES] },
      OR: [{ staffDisplayId: staffIdParam }, { id: staffIdParam }],
    },
    select: { id: true },
  });
  return user?.id ?? null;
}

export const listStaffMembers = async (
  tenantId: string,
  shopId: string | null,
  includeInactive = false,
): Promise<StaffListRow[]> => {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      ...(!includeInactive ? { isActive: true } : {}),
      role: { in: [...STAFF_ASSIGNABLE_ROLES] },
      ...(shopId ? { shopId } : {}),
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      name: true,
      phone: true,
      staffDisplayId: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: [{ staffDisplayId: "asc" }, { createdAt: "asc" }],
  });

  return users.map((u) => ({
    staffId: u.staffDisplayId ?? u.id,
    id: u.id,
    name: (u.name && u.name.trim()) || (u.fullName && u.fullName.trim()) || u.email || u.id,
    email: u.email,
    phone: u.phone,
    role: roleToLabel(u.role),
    isActive: u.isActive,
    createdAt: u.createdAt,
  }));
};

async function nextStaffDisplayId(tenantId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ staffDisplayId: string | null }>>`
    SELECT "staffDisplayId"
    FROM "User"
    WHERE "tenantId" = ${tenantId}
      AND "staffDisplayId" IS NOT NULL
  `;

  let max = 0;
  for (const row of rows) {
    const id = row.staffDisplayId;
    if (!id) continue;
    const match = /^STAFF(\d+)$/i.exec(id);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }

  return `STAFF${max + 1}`;
}

export const createStaffMember = async (
  tenantId: string,
  shopId: string,
  data: CreateStaffInput,
): Promise<{ staffDisplayId: string }> => {
  const staffDisplayId = await nextStaffDisplayId(tenantId);
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  try {
    await prisma.user.create({
      data: {
        tenantId,
        shopId,
        email: data.email,
        password: passwordHash,
        role: data.role,
        name: data.name,
        fullName: data.name,
        phone: data.phone?.trim() ? data.phone.trim() : null,
        staffDisplayId,
        isActive: true,
      } as any,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[])
        : typeof error.meta?.target === "string"
          ? [error.meta.target]
          : [];
      throw { status: 409, code: "DUPLICATE", target };
    }
    throw error;
  }

  return { staffDisplayId };
};

export const updateStaffMember = async (
  tenantId: string,
  shopId: string,
  staffIdParam: string,
  actorUserId: string,
  data: UpdateStaffInput,
): Promise<void> => {
  const targetId = await resolveStaffUserId(tenantId, shopId, staffIdParam);
  if (!targetId) {
    throw { status: 404, code: "NOT_FOUND" };
  }
  if (targetId === actorUserId) {
    throw { status: 400, code: "SELF_ACTION" };
  }

  const passwordHash =
    data.password !== undefined ? await bcrypt.hash(data.password, BCRYPT_ROUNDS) : undefined;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) {
    updateData.name = data.name;
    updateData.fullName = data.name;
  }
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone === null ? null : data.phone.trim() || null;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (passwordHash !== undefined) updateData.password = passwordHash;

  try {
    await prisma.user.update({
      where: { id: targetId },
      data: updateData as any,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[])
        : typeof error.meta?.target === "string"
          ? [error.meta.target]
          : [];
      throw { status: 409, code: "DUPLICATE", target };
    }
    if (error.code === "P2025") {
      throw { status: 404, code: "NOT_FOUND" };
    }
    throw error;
  }
};

export const deactivateStaffMember = async (
  tenantId: string,
  shopId: string,
  staffIdParam: string,
  actorUserId: string,
): Promise<void> => {
  const targetId = await resolveStaffUserId(tenantId, shopId, staffIdParam);
  if (!targetId) {
    throw { status: 404, code: "NOT_FOUND" };
  }
  if (targetId === actorUserId) {
    throw { status: 400, code: "SELF_ACTION" };
  }

  try {
    await prisma.user.update({
      where: { id: targetId },
      data: { isActive: false },
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      throw { status: 404, code: "NOT_FOUND" };
    }
    throw error;
  }
};

export const validateShopIdService = async (
  payload: ValidateShopIdRequestDto,
  context: StaffAuthContextDto,
): Promise<ValidateShopIdResponseDto> => {
  if (!isValidRequestSource(context, payload)) {
    throw new ApiError(401, "Invalid request signature");
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { shopCode: payload.shop_id },
      select: { id: true, shopCode: true, isActive: true, acceptsStaffRegistrations: true },
    });

    if (!shop) {
      throw new ApiError(400, "Invalid Shop ID");
    }

    if (!shop.isActive || !shop.acceptsStaffRegistrations) {
      throw new ApiError(403, "Shop disabled or registration locked");
    }

    return { shop_id: shop.shopCode };
  } catch (error) {
    throw normalizeError(error);
  }
};

export const registerStaffService = async (
  payload: RegisterStaffRequestDto,
  context: StaffAuthContextDto,
): Promise<RegisterStaffResponseDto> => {
  if (!isValidRequestSource(context, payload)) {
    throw new ApiError(401, "Invalid request signature");
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { shopCode: payload.shop_id },
      select: {
        id: true,
        shopCode: true,
        tenantId: true,
        isActive: true,
        acceptsStaffRegistrations: true,
      },
    });

    if (!shop) {
      throw new ApiError(400, "Invalid Shop ID");
    }

    if (!shop.isActive || !shop.acceptsStaffRegistrations) {
      throw new ApiError(403, "Shop disabled or registration locked");
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: payload.phone },
          { email: payload.email.toLowerCase() }
        ]
      },
      select: { id: true, shopId: true, email: true, phone: true },
    });

    if (existingUser) {
      if (existingUser.email?.toLowerCase() === payload.email.toLowerCase()) {
        throw new ApiError(409, "Email already registered");
      }
      if (existingUser.shopId && existingUser.shopId !== shop.id) {
        throw new ApiError(403, "User already registered to another shop");
      }
      if (existingUser.shopId === shop.id) {
        throw new ApiError(403, "User already registered to this shop");
      }
    }

    const hashedPassword = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        fullName: payload.full_name,
        name: payload.full_name,
        phone: payload.phone,
        email: payload.email.toLowerCase(),
        password: hashedPassword,
        role: payload.role,
        tenantId: shop.tenantId,
        shopId: shop.id,
        isActive: true,
      } as any,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        tenantId: true,
        shopId: true,
        isActive: true,
        createdAt: true,
      },
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email ?? "",
      role: user.role as JwtRole,
      shopId: user.shopId,
      tenantId: user.tenantId,
    });

    return {
      staff: {
        ...user,
        role: user.role as JwtRole,
      },
      access_token: accessToken,
    };
  } catch (error) {
    throw normalizeError(error);
  }
};

export const getStaffDashboardContextService = async (
  userId: string,
): Promise<StaffDashboardContextDto | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
      tenantId: true,
      shopId: true,
      isActive: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    ...user,
    role: user.role as JwtRole,
  };
};
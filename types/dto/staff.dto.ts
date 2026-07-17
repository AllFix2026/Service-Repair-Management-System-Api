import type { JwtRole } from "@/utils/jwt.util";

export type StaffRole = Extract<JwtRole, "TECHNICIAN" | "MANAGER">;

export interface ValidateShopIdRequestDto {
  shop_id: string;
}

export interface RegisterStaffRequestDto {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  shop_id: string;
  role: StaffRole;
}

export interface StaffAuthContextDto {
  request_source?: string;
  request_signature?: string;
  request_timestamp?: string;
}

export interface ValidateShopIdResponseDto {
  shop_id: string;
}

export interface RegisterStaffResponseDto {
  staff: {
    id: string;
    fullName: string;
    phone: string | null;
    role: JwtRole;
    tenantId: string;
    shopId: string | null;
    isActive: boolean;
    createdAt: Date;
  };
  access_token: string;
}

export interface StaffDashboardContextDto {
  id: string;
  fullName: string;
  phone: string | null;
  role: JwtRole;
  tenantId: string;
  shopId: string | null;
  isActive: boolean;
}
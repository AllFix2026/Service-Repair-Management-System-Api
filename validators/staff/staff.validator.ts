import { STAFF_ASSIGNABLE_ROLES } from "@/types/staff.types";
import { z } from "zod";

const staffRoleSchema = z.enum(STAFF_ASSIGNABLE_ROLES, {
  message: "role must be ADMIN, MANAGER, or TECHNICIAN",
});

export const createStaffSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(staffRoleSchema),
  phone: z.string().optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z
  .object({
    name: z.string().min(1, "name cannot be empty").optional(),
    email: z.string().email("Invalid email format").optional(),
    phone: z.union([z.string(), z.null()]).optional(),
    role: z
      .string()
      .transform((v) => v.toUpperCase())
      .pipe(staffRoleSchema)
      .optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8, "Password must be at least 8 characters").optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field is required",
    path: ["body"],
  });
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

const staffRegistrationRoleSchema = z.enum(["TECHNICIAN", "MANAGER"]);

export const validateShopIdSchema = z.object({
  shop_id: z.string().min(1, "shop_id is required"),
});

export const registerStaffSchema = z.object({
  full_name: z.string().min(1, "full_name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(8, "phone is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  shop_id: z.string().min(1, "shop_id is required"),
  role: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(staffRegistrationRoleSchema),
});
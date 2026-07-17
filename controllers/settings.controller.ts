import { logger } from "@/config/logger.config";
import { getShopSettings, updateShopSettings } from "@/services/settings/settings.service";
import type { AuthRequest } from "@/types/auth.types";
import { updateSettingsSchema } from "@/validators/settings/settings.validator";
import type { Response } from "express";

export const getSettings = async (req: AuthRequest, res: Response) => {
  const shopId = req.user?.shopId;
  if (!shopId) {
    return res.status(400).json({ error: "Unable to retrieve settings" });
  }

  try {
    const settings = await getShopSettings(req.user!.tenantId, shopId);
    return res.status(200).json(settings);
  } catch (error: any) {
    logger.error(`[getSettings] -> ${error?.message ?? error}`);
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Unable to retrieve settings" });
    }
    return res.status(500).json({ error: "Unable to retrieve settings" });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  const shopId = req.user?.shopId;
  if (!shopId) {
    return res.status(400).json({ error: "Unable to update settings" });
  }

  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(`[updateSettings] -> Validation failed: ${parsed.error.message}`);
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: parsed.error.issues,
    });
  }

  try {
    console.log('[updateSettings] Request Body:', JSON.stringify(req.body, null, 2));
    console.log('[updateSettings] Parsed Data:', JSON.stringify(parsed.data, null, 2));
    await updateShopSettings(req.user!.tenantId, shopId, parsed.data);
    return res.status(200).json({ message: "Settings updated successfully" });
  } catch (error: any) {
    console.error('[updateSettings] Error:', error);
    logger.error(`[updateSettings] -> ${error?.message ?? error}`);
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Unable to update settings" });
    }
    const status = typeof error?.status === "number" ? error.status : 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    return res.status(safeStatus).json({ error: "Unable to update settings" });
  }
};

import { Response, Request } from "express";
import { AuthRequest } from "@/types/auth.types";
import { globalSearch } from "@/services/search/search.service";

export const searchEntities = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const tenantId = authReq.user?.tenantId;
    const shopId = authReq.user?.shopId;
    const query = req.query.q as string;

    if (!tenantId || !shopId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!query || query.trim().length === 0) {
      res.status(200).json({ success: true, message: "Empty search query", data: [] });
      return;
    }

    const results = await globalSearch(query, tenantId, shopId);

    res.status(200).json({ success: true, message: "Search results fetched successfully", data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

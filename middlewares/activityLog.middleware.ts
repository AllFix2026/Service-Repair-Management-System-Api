import { Request, Response, NextFunction } from "express";
import { prisma } from "@/db/prisma";
import { AuthRequest } from "@/types/auth.types";
import { logger } from "@/config/logger.config";

// Map HTTP methods + route patterns to human-readable action labels
function resolveAction(method: string, path: string): { action: string; entity: string } | null {
  const m = method.toUpperCase();

  // Only log mutating operations
  if (m === "GET" || m === "OPTIONS" || m === "HEAD") return null;

  // Parse entity from path, e.g. /v1/repairs/123/notes → "repairs", "123", "notes"
  const segments = path.replace(/^\/api\/v1\//, "").replace(/^\/v1\//, "").split("/");
  const resource = segments[0]?.toLowerCase() ?? "unknown";
  const nested = segments.length > 2 ? segments[2]?.toLowerCase() : null;

  const entityMap: Record<string, string> = {
    repairs: "Repair",
    customers: "Customer",
    devices: "Device",
    inventory: "Inventory",
    invoices: "Invoice",
    payments: "Payment",
    staff: "Staff",
    settings: "Settings",
    appointments: "Appointment",
    tasks: "Task",
    suppliers: "Supplier",
    "purchase-orders": "Purchase Order",
    "service-requests": "Service Request",
    users: "User",
    shops: "Shop",
  };

  let entity = entityMap[resource] ?? resource.charAt(0).toUpperCase() + resource.slice(1);
  let actionBase = entity.toUpperCase().replace(/ /g, "_");

  if (nested) {
    if (nested === "notes") actionBase = `${actionBase}_NOTE`;
    else if (nested === "status") actionBase = `${actionBase}_STATUS`;
    else if (nested === "confirm") actionBase = `${actionBase}_CONFIRM`;
    else if (nested === "offer") actionBase = `${actionBase}_OFFER`;
  }

  const actionMap: Record<string, string> = {
    POST: `CREATE_${actionBase}`,
    PUT: `UPDATE_${actionBase}`,
    PATCH: `UPDATE_${actionBase}`,
    DELETE: `DELETE_${actionBase}`,
  };

  const action = actionMap[m] ?? `${m}_${actionBase}`;
  return { action, entity };
}

// Extract financial amount from request body if present
function extractAmount(body: any): { amount?: number; amountLabel?: string } {
  if (!body || typeof body !== "object") return {};
  
  if (body.finalCost != null) return { amount: Number(body.finalCost), amountLabel: "Final Cost" };
  if (body.estimatedCost != null) return { amount: Number(body.estimatedCost), amountLabel: "Estimated Cost" };
  if (body.amount != null) return { amount: Number(body.amount), amountLabel: "Payment Amount" };
  if (body.totalAmount != null) return { amount: Number(body.totalAmount), amountLabel: "Total Amount" };
  if (body.labourCost != null) return { amount: Number(body.labourCost), amountLabel: "Labour Cost" };
  if (body.quotedAmount != null) return { amount: Number(body.quotedAmount), amountLabel: "Quoted Amount" };
  if (body.unitPrice != null) return { amount: Number(body.unitPrice), amountLabel: "Unit Price" };
  if (body.totalCost != null) return { amount: Number(body.totalCost), amountLabel: "Total Cost" };
  
  return {};
}

// The actual middleware — runs AFTER the response is sent
export function activityLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    // Only log if successful (2xx) and user is authenticated
    const authReq = req as AuthRequest;
    const user = authReq.user;

    if (user && res.statusCode >= 200 && res.statusCode < 300) {
      const resolved = resolveAction(req.method, req.path);
      if (resolved) {
        const { action, entity } = resolved;
        const { amount, amountLabel } = extractAmount(req.body);

        // Extract entityId from params or response body (non-blocking)
        const entityId =
          req.params?.id ||
          body?.data?.id ||
          body?.repair?.id ||
          body?.customer?.id ||
          body?.id ||
          undefined;

        // Fire and forget — don't await so it never slows down the response
        prisma.activityLog.create({
          data: {
            tenantId: user.tenantId,
            shopId: user.shopId ?? user.tenantId,
            userId: user.id,
            userName: (user as any).name || (user as any).fullName || user.email || "Unknown",
            userRole: user.role,
            action,
            entity,
            entityId: entityId ? String(entityId) : undefined,
            amount,
            amountLabel,
            details: {
              method: req.method,
              path: req.path,
              body: req.body ? sanitizeBody(req.body) : undefined,
            },
          },
        }).catch((err: Error) => {
          logger.warn(`[ActivityLog] Failed to write log: ${err.message}`);
        });
      }
    }

    return originalJson(body);
  };

  next();
}

// Remove sensitive fields before storing in log
function sanitizeBody(body: any): any {
  if (!body || typeof body !== "object") return body;
  const SENSITIVE = ["password", "token", "secret", "cardNumber", "cvv", "pin"];
  const sanitized: any = { ...body };
  for (const key of SENSITIVE) {
    if (key in sanitized) sanitized[key] = "[REDACTED]";
  }
  return sanitized;
}

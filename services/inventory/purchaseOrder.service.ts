import { prisma } from "@/db/prisma";
import { CreatePurchaseOrderRequest, UpdatePurchaseOrderStatusRequest } from "@/types/dto/inventory.dto";
import { logger } from "@/config/logger.config";
import { sendSms } from "@/services/notification/notification.service";

export const createPurchaseOrder = async (
  data: CreatePurchaseOrderRequest,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[createPurchaseOrder] -> Creating PO: ${data.orderNumber} for supplier: ${data.supplierId}`);

  const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId,
      shopId,
      supplierId: data.supplierId,
      orderNumber: data.orderNumber,
      notes: data.notes ?? null,
      expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
      totalAmount,
      items: {
        create: data.items.map(item => ({
          partId: item.partId ?? null,
          partName: item.partName,
          sku: item.sku ?? null,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost
        }))
      }
    },
    include: {
      items: true,
      supplier: true,
      shop: { select: { name: true, address: true, city: true, phone: true } }
    }
  });

  if (po.supplier?.phone) {
    const shopName = po.shop?.name || "Our Shop";
    const itemList = po.items.map(item => `${item.quantity}x ${item.partName}`).join(", ");
    const addressParts = [po.shop?.address, po.shop?.city].filter(Boolean).join(", ");
    const shopContact = po.shop?.phone ? `\nContact: ${po.shop.phone}` : "";
    const shopFooter = `\n${shopName}${addressParts ? `\n${addressParts}` : ""}${shopContact}`;
    const message = `Hello ${po.supplier.name},\nA new Purchase Order (${po.orderNumber}) has been created by ${shopName}.\nItems: ${itemList}\nTotal Amount: Rs. ${totalAmount}${shopFooter}`;
    await sendSms(po.supplier.phone, message).catch(err => {
      console.error("Non-fatal: Failed to send SMS for PO creation:", err);
    });
  }

  return po;
};

export const getPurchaseOrders = async (tenantId: string, shopId: string) => {
  logger.info(`[getPurchaseOrders] -> Fetching POs for shop: ${shopId}`);

  return await prisma.purchaseOrder.findMany({
    where: { tenantId, shopId },
    include: {
      supplier: {
        select: { id: true, name: true, email: true, phone: true }
      },
      items: true,
    },
    orderBy: { createdAt: "desc" }
  });
};

export const updatePurchaseOrderStatus = async (
  poId: string,
  data: UpdatePurchaseOrderStatusRequest,
  tenantId: string,
  shopId: string,
  adminId: string
) => {
  logger.info(`[updatePurchaseOrderStatus] -> Updating PO: ${poId} to status: ${data.status}`);

  const existingPO = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { status: true }
  });

  const po = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: data.status,
      ...(data.receivedAt && { receivedAt: new Date(data.receivedAt) })
    },
    include: {
      items: true
    }
  });

  // Create Audit Log
  await prisma.purchaseOrderAudit.create({
    data: {
      tenantId,
      shopId,
      purchaseOrderId: poId,
      adminId,
      oldStatus: existingPO?.status,
      newStatus: data.status,
      notes: "Status updated via status toggle"
    }
  });

  // If status is RECEIVED, update inventory stock
  if (data.status === "RECEIVED") {
    logger.info(`[updatePurchaseOrderStatus] -> PO ${poId} RECEIVED, updating inventory stock`);
    
    for (const item of po.items) {
      if (item.partId) {
        await prisma.partsInventory.update({
          where: { id: item.partId },
          data: {
            quantityInStock: { increment: item.quantity }
          }
        });
      }
    }
  }

  return po;
};

export const updatePurchaseOrder = async (
  poId: string,
  data: any,
  tenantId: string,
  shopId: string,
  adminId: string
) => {
  logger.info(`[updatePurchaseOrder] -> Updating PO: ${poId}`);

  // We check for RECEIVED status transition to update inventory
  const existingPO = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true }
  });

  if (!existingPO) throw { status: 404, message: "Purchase Order not found" };

  const updatedPO = await prisma.purchaseOrder.update({
    where: { id: poId, tenantId, shopId },
    data: {
      status: data.status,
      notes: data.notes,
      expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
    },
    include: { items: true }
  });

  // Create Audit Log
  if (data.status !== existingPO.status || data.notes !== existingPO.notes) {
    await prisma.purchaseOrderAudit.create({
      data: {
        tenantId,
        shopId,
        purchaseOrderId: poId,
        adminId,
        oldStatus: existingPO.status,
        newStatus: data.status,
        notes: data.notes || "PO details updated"
      }
    });
  }

  // If status changed to RECEIVED, update inventory
  if (data.status === "RECEIVED" && existingPO.status !== "RECEIVED") {
    logger.info(`[updatePurchaseOrder] -> PO ${poId} transitioned to RECEIVED, updating inventory`);
    for (const item of updatedPO.items) {
      if (item.partId) {
        await prisma.partsInventory.update({
          where: { id: item.partId },
          data: {
            quantityInStock: { increment: item.quantity }
          }
        });
      }
    }
  }

  return updatedPO;
};

export const deletePurchaseOrder = async (
  poId: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[deletePurchaseOrder] -> Deleting PO: ${poId}`);

  // Items are deleted automatically via Cascade
  // Audits are also deleted automatically via Cascade (added to schema)
  return await prisma.purchaseOrder.delete({
    where: { id: poId, tenantId, shopId }
  });
};

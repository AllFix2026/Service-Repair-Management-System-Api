import { prisma } from "@/db/prisma";
import { Priority } from "@prisma/client";

export const getTenantRepairs = async (
  tenantId: string, 
  page?: number,
  limit?: number
) => {
  const hasPagination = page !== undefined && limit !== undefined;
  const skip = hasPagination ? (page - 1) * limit : undefined;
  const take = hasPagination ? limit : undefined;

  return prisma.repair.findMany({
    where: { tenantId },
    include: { 
      customer: true, 
      device: true, 
      technician: { select: { id: true, email: true, fullName: true, role: true } },
      repairPartsUsed: { include: { part: true } },
      photos: { orderBy: { createdAt: 'asc' } }
    },
    orderBy: { createdAt: 'desc' },
    ...(hasPagination ? { skip, take } : {}),
  });
};

export const getTenantRepairById = async (id: string, tenantId: string) => {
  const repair = await prisma.repair.findFirst({
    where: { id, tenantId },
    include: { 
      customer: true, 
      device: true, 
      technician: { select: { id: true, email: true, fullName: true, role: true } }, 
      notes: { include: { user: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' } },
      timeline: { orderBy: { createdAt: 'desc' } },
      photos: { orderBy: { createdAt: 'asc' } },
      repairPartsUsed: { include: { part: true } }
    },
  });

  if (!repair) {
    throw { status: 404, message: "Repair not found" };
  }

  return repair;
};

export const createTenantRepair = async (
  tenantId: string,
  data: {
    shopId: string;
    customerId: string;
    deviceId: string;
    issue?: string;
    internalNotes?: string;
    diagnosis?: string;
    priority?: Priority;
    estimatedCompletionDate?: Date;
    estimatedCost?: number;
    finalCost?: number;
    technicianId?: string;
    status?: any;
    photoUrls?: string[];
    userId: string;
    partsUsed?: { partId: string; quantity: number; unitPrice: number; }[];
    advancePayment?: number;
  }
) => {
  const reference = `REP-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
  
  // Extract non-DB fields before saving
  const { photoUrls, partsUsed, userId, ...repairData } = data;

  const repair = await prisma.repair.create({
    data: { 
      tenantId, 
      reference,
      ...repairData 
    },
  });

  // Save photos to Photo table
  if (photoUrls && photoUrls.length > 0) {
    await prisma.photo.createMany({
      data: photoUrls.map((url: string) => ({
        tenantId,
        repairId: repair.id,
        url,
        stage: 'INTAKE',
      }))
    });
  }

  // Save Parts Used
  if (data.partsUsed && data.partsUsed.length > 0) {
    await prisma.repairPartsUsed.createMany({
      data: data.partsUsed.map(part => ({
        repairId: repair.id,
        partId: part.partId,
        quantityUsed: part.quantity,
        unitPrice: part.unitPrice,
        totalPrice: part.unitPrice * part.quantity,
        addedByUserId: data.userId,
      }))
    });

    // Deduct inventory quantities
    for (const part of data.partsUsed) {
      try {
        await prisma.partsInventory.update({
          where: { id: part.partId },
          data: {
            quantityInStock: { decrement: part.quantity }
          }
        });
      } catch (err: any) {
        console.error(`Failed to deduct inventory for part ${part.partId}:`, err);
      }
    }
  }

  await logTimelineEvent(repair.id, 'CREATED', `Repair created with status ${data.status || 'NOT_STARTED'}`);

  const isPaid = (data.status as any) === 'PAID' || data.status === 'DELIVERED';

  // Automatically create an invoice (Payment record) for the repair
  await prisma.payment.create({
    data: {
      tenantId,
      shopId: data.shopId,
      repairId: repair.id,
      customerId: data.customerId,
      amount: data.finalCost || data.estimatedCost || 0,
      paymentMethod: 'CASH', // Default
      paymentType: 'FULL',   // Default
      status: isPaid ? 'COMPLETED' : 'PENDING',
      ...(isPaid && { paymentDate: new Date() }),
      notes: `Automatically generated invoice for repair ${reference}`,
    }
  });

  return repair;
};

import { sendSms } from "@/services/notification/notification.service";

export const updateTenantRepair = async (
  id: string,
  tenantId: string,
  data: Record<string, any>
) => {
  try {
    const oldRepair = await prisma.repair.findFirst({ 
      where: { id }, 
      include: { customer: true, device: true, shop: { select: { name: true, address: true, city: true, phone: true } } } 
    });
    
    // Extract non-db fields from data so it doesn't try to update them in the DB
    const { autoUpdateCustomer, userId, partsUsed, ...updateData } = data;

    const repair = await prisma.repair.update({
      where: { id },
      data: updateData,
    });

    if (partsUsed !== undefined) {
      // Fetch existing parts to restore inventory
      const existingParts = await prisma.repairPartsUsed.findMany({
        where: { repairId: id }
      });
      
      // Restore inventory
      for (const ep of existingParts) {
        try {
          await prisma.partsInventory.update({
            where: { id: ep.partId },
            data: { quantityInStock: { increment: ep.quantityUsed } }
          });
        } catch (err) { console.error("Restore inventory error:", err); }
      }

      // Delete existing
      await prisma.repairPartsUsed.deleteMany({
        where: { repairId: id }
      });

      // Add new parts
      if (partsUsed.length > 0) {
        await prisma.repairPartsUsed.createMany({
          data: partsUsed.map((part: any) => ({
            repairId: id,
            partId: part.partId,
            quantityUsed: part.quantity,
            unitPrice: part.unitPrice,
            totalPrice: part.unitPrice * part.quantity,
            addedByUserId: userId,
          }))
        });

        // Deduct inventory
        for (const part of partsUsed) {
          try {
            await prisma.partsInventory.update({
              where: { id: part.partId },
              data: { quantityInStock: { decrement: part.quantity } }
            });
          } catch (err) { console.error("Deduct inventory error:", err); }
        }
      }
    }

    try {
      if (updateData.status) {
        await logTimelineEvent(id, 'STATUS_CHANGE', `Status changed from ${oldRepair?.status || 'UNKNOWN'} to ${updateData.status}`);
        
        // Send SMS to customer if requested
        if (autoUpdateCustomer && oldRepair?.customer?.phone) {
          const shopName = oldRepair.shop?.name || "Our Shop";
          const ref = oldRepair.reference;
          const statusText = updateData.status.replace(/_/g, " ");
          const deviceName = oldRepair.device ? `${oldRepair.device.brand} ${oldRepair.device.model}` : "your device";
          const issue = oldRepair.issue ? ` (${oldRepair.issue})` : "";
          const addressParts = [oldRepair.shop?.address, oldRepair.shop?.city].filter(Boolean).join(", ");
          const shopContact = oldRepair.shop?.phone ? `\nContact: ${oldRepair.shop.phone}` : "";
          // Calculate financial summary for customer SMS
          const totalCost = Number(updateData.finalCost ?? oldRepair.finalCost ?? updateData.estimatedCost ?? oldRepair.estimatedCost ?? 0);
          const advancePaid = Number(updateData.advancePayment ?? oldRepair.advancePayment ?? 0);
          const remaining = Math.max(0, totalCost - advancePaid);

          let costDetails = "";
          if (totalCost > 0) {
            if (updateData.status === 'PAID' || remaining === 0) {
              costDetails = `\nTotal Paid: Rs. ${totalCost.toLocaleString()}`;
            } else if (advancePaid > 0) {
              costDetails = `\nTotal Amount: Rs. ${totalCost.toLocaleString()}\nAdvance Paid: -Rs. ${advancePaid.toLocaleString()}\nBalance Due: Rs. ${remaining.toLocaleString()}`;
            } else {
              costDetails = `\nTotal Amount: Rs. ${totalCost.toLocaleString()}`;
            }
          }

          const shopFooter = `\n${shopName}${addressParts ? `\n${addressParts}` : ""}${shopContact}`;

          let message = `Hi ${oldRepair.customer.name},\nYour repair task (${ref}) for ${deviceName}${issue} status has been updated to: ${statusText}.${costDetails}${shopFooter}`;

          if (['READY_TO_TAKE', 'COMPLETED', 'DELIVERED'].includes(updateData.status)) {
            const invoiceUrl = `https://www.allfix.space/invoice/${ref}`;
            message = `Hi ${oldRepair.customer.name},\nYour repair task (${ref}) for ${deviceName}${issue} is ready for collection!${costDetails}\n\nView & Download Invoice: ${invoiceUrl}${shopFooter}`;
          }

          if (updateData.status === 'PAID') {
            const invoiceUrl = `https://www.allfix.space/invoice/${ref}`;
            message = `Hi ${oldRepair.customer.name},\nThank you for collecting your device and paying for our service! We truly appreciate your trust in ${shopName}.${costDetails}\n\nWe hope to see you again whenever you need us. 😊\n\nView & Download Invoice: ${invoiceUrl}${shopFooter}`;
          }
          
          await sendSms(oldRepair.customer.phone, message).catch((err) => {
            console.error("Failed to send SMS:", err);
          });
        }
      }
    } catch (logError) {
      console.error("Non-fatal: Failed to log timeline event or send SMS:", logError);
    }

    // Synchronize with Invoice (Payment record)
    const existingPayment = await prisma.payment.findFirst({
      where: { repairId: id, tenantId }
    });

    const isPaid = (data.status as any) === 'PAID' || data.status === 'DELIVERED';

    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          amount: data.finalCost || data.estimatedCost || existingPayment.amount,
          status: isPaid ? 'COMPLETED' : existingPayment.status,
          // Force update paymentDate to Today whenever it's marked as PAID to satisfy real-time tracking
          ...(isPaid && { paymentDate: new Date() })
        }
      });
    } else if (isPaid || data.estimatedCost || data.finalCost) {
      await prisma.payment.create({
        data: {
          tenantId,
          shopId: repair.shopId,
          repairId: id,
          customerId: repair.customerId,
          amount: data.finalCost || data.estimatedCost || 0,
          paymentMethod: 'CASH',
          paymentType: 'FULL',
          status: isPaid ? 'COMPLETED' : 'PENDING',
          ...(isPaid && { paymentDate: new Date() })
        }
      });
    }

    return repair;
  } catch (error: any) {
    if (error.code === "P2025") {
      throw { status: 404, message: "Repair not found" };
    }
    throw error;
  }
};

export const addRepairNote = async (repairId: string, userId: string, text: string) => {
  const note = await prisma.repairNote.create({
    data: { repairId, userId, text },
    include: { user: { select: { fullName: true } } }
  });

  await logTimelineEvent(repairId, 'NOTE_ADDED', 'New technician note added', userId);

  // Handle Mentions and trigger notifications
  try {
    const repair = await prisma.repair.findUnique({
      where: { id: repairId },
      select: { reference: true, tenantId: true, shopId: true }
    });

    if (repair) {
      // Regex to match words starting with @ (e.g., @Saiethya Suresh) up to next @ or space
      const mentionRegex = /@([^@\n\r\t]+?)(?=\s|@|$)/g;
      let match;
      const mentionedNames: string[] = [];
      while ((match = mentionRegex.exec(text)) !== null) {
        if (match[1] && match[1].trim()) {
          mentionedNames.push(match[1].trim());
        }
      }

      if (mentionedNames.length > 0) {
        // Find users with these names in the tenant
        const matchingUsers = await prisma.user.findMany({
          where: {
            tenantId: repair.tenantId,
            fullName: { in: mentionedNames, mode: 'insensitive' }
          },
          select: { id: true, fullName: true }
        });

        // Create notification for each mentioned user
        const authorName = note.user?.fullName || "A team member";
        for (const user of matchingUsers) {
          // Prevent notifying oneself
          if (user.id === userId) continue;

          await prisma.notification.create({
            data: {
              tenantId: repair.tenantId,
              shopId: repair.shopId,
              repairId: repairId,
              to: user.id,
              channel: "IN_APP",
              title: "You were mentioned in a note",
              message: `${authorName} mentioned you in repair task #${repair.reference}`,
              type: "REPAIR",
              status: "PENDING",
              isRead: false,
              isCleared: false
            }
          });
        }
      }
    }
  } catch (error) {
    console.error("Non-fatal: Failed to send mention notifications:", error);
  }

  return note;
};

export const logTimelineEvent = async (repairId: string, type: string, description: string, userId?: string) => {
  return prisma.repairTimelineEvent.create({
    data: { repairId, type, description, userId }
  });
};

export const deleteTenantRepair = async (id: string, tenantId: string): Promise<void> => {
  try {
    await prisma.repair.delete({
      where: { id, tenantId },
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      throw { status: 404, message: "Repair not found" };
    }
    throw error;
  }
};

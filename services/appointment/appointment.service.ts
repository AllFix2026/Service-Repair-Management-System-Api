import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";
import { sendSms } from "../notification/notification.service";
// import { format } from "date-fns"; // Removed to avoid dependency issue


export const getAppointments = async (tenantId: string, shopId?: string) => {
  logger.info(`[getAppointments] -> Fetching appointments for tenant: ${tenantId}`);

  const appointments = await (prisma as any).appointment.findMany({
    where: {
      tenantId,
      ...(shopId ? { shopId } : {}),
    },
    include: {
      customer: { select: { name: true, phone: true } },
      technician: { select: { fullName: true } },
      repair: { select: { reference: true, status: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return appointments.map((a: any) => ({
    id: a.id,
    scheduledAt: a.scheduledAt,
    duration: a.duration,
    status: a.status,
    customerName: a.customer?.name ?? "Walk-In",
    technicianName: a.technician?.fullName ?? "Unassigned",
    technicianId: a.technicianId,
    repairReference: a.repair?.reference,
    repairId: a.repairId,
    notes: a.notes,
  }));
};

export const createAppointment = async (
  tenantId: string,
  data: {
    shopId: string;
    customerId?: string;
    technicianId?: string;
    repairId?: string;
    scheduledAt: Date;
    duration?: number;
    notes?: string;
    type?: string; // "Call" or "Meeting"
  }
) => {
  logger.info(`[createAppointment] -> Creating appointment for tenant: ${tenantId}`);

  const appointment = await (prisma as any).appointment.create({
    data: {
      tenantId,
      shopId: data.shopId,
      customerId: data.customerId ?? null,
      technicianId: data.technicianId ?? null,
      repairId: data.repairId ?? null,
      scheduledAt: data.scheduledAt,
      duration: data.duration ?? 60,
      notes: data.notes ?? null,
    },
    include: {
      customer: { select: { name: true, phone: true } }
    }
  });

  // Send SMS notification if customer exists and has phone
  if (appointment.customer?.phone) {
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(new Date(data.scheduledAt));

    const msg = `Hi ${appointment.customer.name}, your ${data.type || 'Appointment'} has been scheduled for ${formattedDate}. Notes: ${data.notes || 'N/A'}. Thank you!`;

    
    try {
      await sendSms(appointment.customer.phone, msg);
    } catch (err) {
      logger.error(`[createAppointment] -> SMS delivery failed but appointment created: ${err}`);
    }
  }

  return appointment;
};

export const updateAppointment = async (
  id: string,
  tenantId: string,
  data: Partial<{
    scheduledAt: Date;
    duration: number;
    status: string;
    technicianId: string;
    notes: string;
  }>
) => {
  const existing = await (prisma as any).appointment.findFirst({ where: { id, tenantId } });
  if (!existing) throw { status: 404, message: "Appointment not found" };

  return (prisma as any).appointment.update({
    where: { id },
    data: {
      ...data,
      ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
    },
  });
};

export const deleteAppointment = async (id: string, tenantId: string) => {
  const existing = await (prisma as any).appointment.findFirst({ where: { id, tenantId } });
  if (!existing) throw { status: 404, message: "Appointment not found" };

  await (prisma as any).appointment.delete({ where: { id } });
};

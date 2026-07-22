import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";
import { sendDemoBookingStatusEmail } from "@/services/email/email.service";

export const createDemoBooking = async (data: {
  name: string;
  email: string;
  phone?: string;
  date: string | Date;
  time: string;
  notes?: string;
}) => {
  logger.info(`[createDemoBooking] -> Creating demo booking for ${data.email}`);
  
  // Create DemoBooking using direct cast to avoid TS error if client not generated yet
  const booking = await (prisma as any).demoBooking.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      date: new Date(data.date),
      time: data.time,
      notes: data.notes,
    },
  });

  return booking;
};

export const getAllDemoBookings = async () => {
  logger.info(`[getAllDemoBookings] -> Fetching all demo bookings`);
  return await (prisma as any).demoBooking.findMany({
    orderBy: { createdAt: "desc" },
  });
};

export const updateDemoBookingStatus = async (id: string, status: string) => {
  logger.info(`[updateDemoBookingStatus] -> Updating status of booking ${id} to ${status}`);
  
  const existing = await (prisma as any).demoBooking.findUnique({ where: { id } });
  if (!existing) {
    throw { status: 404, message: "Booking not found" };
  }

  const updated = await (prisma as any).demoBooking.update({
    where: { id },
    data: { status },
  });

  // Send email notification for accept/decline
  if (status === 'SCHEDULED' || status === 'CANCELLED') {
    // Send email asynchronously without awaiting to not block the request
    sendDemoBookingStatusEmail(existing.email, existing.name, status as 'SCHEDULED' | 'CANCELLED')
      .catch(err => logger.error(`[updateDemoBookingStatus] -> Failed to send email to ${existing.email}`));
  }

  return updated;
};

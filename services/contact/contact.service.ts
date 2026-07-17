import { prisma } from '../../db/prisma';

export const createContactMessage = async (data: { name: string; email: string; subject?: string; message: string }) => {
  return await prisma.contactMessage.create({
    data
  });
};

export const getAllContactMessages = async () => {
  return await prisma.contactMessage.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });
};

export const markMessageAsRead = async (id: string) => {
  return await prisma.contactMessage.update({
    where: { id },
    data: { isRead: true }
  });
};

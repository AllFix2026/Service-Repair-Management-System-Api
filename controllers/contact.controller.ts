import { Request, Response } from 'express';
import { createContactMessage, getAllContactMessages, markMessageAsRead } from '../services/contact/contact.service';

export const submitContactMessage = async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const contactMessage = await createContactMessage({ name, email, subject, message });
    res.status(201).json({ success: true, data: contactMessage });
  } catch (error: any) {
    console.error('Error submitting contact message:', error);
    res.status(500).json({ error: 'Failed to submit contact message.' });
  }
};

export const getContactMessages = async (req: Request, res: Response) => {
  try {
    const messages = await getAllContactMessages();
    res.status(200).json({ success: true, data: messages });
  } catch (error: any) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({ error: 'Failed to fetch contact messages.' });
  }
};

export const readContactMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const message = await markMessageAsRead(id as string);
    res.status(200).json({ success: true, data: message });
  } catch (error: any) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to update message.' });
  }
};

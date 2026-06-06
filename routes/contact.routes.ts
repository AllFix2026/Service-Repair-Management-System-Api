import { Router } from 'express';
import { submitContactMessage, getContactMessages, readContactMessage } from '../controllers/contact.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Public route for submitting contact form
router.post('/', submitContactMessage);

// Admin routes for viewing messages
router.get('/', authenticate, getContactMessages);
router.put('/:id/read', authenticate, readContactMessage);

export default router;

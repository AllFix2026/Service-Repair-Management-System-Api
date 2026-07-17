import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadToSupabase } from '../services/storage/supabase.service';
import { prisma } from '../db/prisma';

const router = Router();

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.post('/image', upload.single('photo'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = (req as any).file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const { buffer, originalname, mimetype } = file;
    const { repairId } = req.body;
    const user = (req as any).user;

    // Call Supabase service to upload
    const publicUrl = await uploadToSupabase(buffer, originalname, mimetype, 'repair-photos');

    // If a repairId was provided, save the photo to the Photo DB table
    if (repairId && user?.tenantId) {
      await prisma.photo.create({
        data: {
          tenantId: user.tenantId,
          repairId,
          url: publicUrl,
          stage: 'INTAKE',
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      url: publicUrl,
    });
  } catch (error: any) {
    console.error('Error in /uploads/image endpoint', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload image' });
  }
});

router.delete('/image/:photoId', async (req: Request, res: Response): Promise<void> => {
  try {
    const photoId = req.params.photoId as string;
    const user = (req as any).user;
    
    if (!user?.tenantId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Verify photo belongs to tenant and delete
    const photo = await prisma.photo.findFirst({
      where: { id: photoId, tenantId: user.tenantId }
    });

    if (!photo) {
      res.status(404).json({ success: false, message: 'Photo not found' });
      return;
    }

    await prisma.photo.delete({
      where: { id: photoId }
    });

    res.status(200).json({ success: true, message: 'Photo deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting photo', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete photo' });
  }
});

export default router;

import { createClient } from '@supabase/supabase-js';
import { env } from '@/utils/env.util';
import { logger } from '@/utils/common.util';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = env.SUPABASE_URL || '';
const supabaseKey = env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  logger.warn('Supabase URL or Service Key is missing. Storage uploads will fail.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Uploads a file to Supabase Storage
 * @param fileBuffer The binary buffer of the file
 * @param fileName The original filename (to extract extension)
 * @param mimeType The mime type of the file
 * @param folder The folder path inside the bucket (e.g., 'repairs')
 * @returns The public URL of the uploaded file
 */
export const uploadToSupabase = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folder = 'repairs'
): Promise<string> => {
  try {
    const fileExt = fileName.split('.').pop() || 'png';
    const uniqueFileName = `${folder}/${uuidv4()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('repair-photos')
      .upload(uniqueFileName, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      logger.error(`Supabase upload error: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('repair-photos')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    logger.error('Error uploading file to Supabase', error);
    throw error;
  }
};

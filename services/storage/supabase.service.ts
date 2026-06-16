import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../../utils/env.util';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

const supabaseUrl = getEnv('SUPABASE_URL', { required: false }) || '';
const supabaseKey = getEnv('SUPABASE_SERVICE_KEY', { required: false }) || '';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Service Key is missing. Storage uploads are unavailable.');
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
      realtime: {
        transport: WebSocket as any,
      },
    });
  }

  return supabase;
}

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
    const supabaseClient = getSupabaseClient();
    const fileExt = fileName.split('.').pop() || 'png';
    const uniqueFileName = `${folder}/${uuidv4()}.${fileExt}`;

    const { data, error } = await supabaseClient.storage
      .from('repair-photos')
      .upload(uniqueFileName, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error(`Supabase upload error: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from('repair-photos')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading file to Supabase', error);
    throw error;
  }
};

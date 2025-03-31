import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  // Upload file with overwrite protection
  async uploadFile(folder: 'gov_ids' | 'selfies', fileName: string, file: File) {
    const bucket = 'votecertify-uploads';
    const filePath = `${folder}/${fileName}`; // Ensure correct folder structure

    try {
      // Check if file already exists
      const { data: existingFile, error: fileError } = await this.supabase.storage.from(bucket).list(folder, {
        search: fileName
      });

      if (existingFile?.length) {
        throw new Error(`File "${fileName}" already exists in ${folder}!`);
      }
    } catch (checkError) {
      if (checkError instanceof Error && !checkError.message.includes('not found')) {
        console.error('Error checking file existence:', checkError);
        throw checkError;
      }
    }

    // Upload file
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file:', error);
      throw error;
    }

    return data;
  }

  // Generate a signed URL (valid for 1 hour)
  async getSignedFileUrl(folder: 'gov_ids' | 'selfies', fileName: string) {
    const bucket = 'votecertify-uploads';
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }

    return data.signedUrl;
  }
}

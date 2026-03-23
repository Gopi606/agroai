import { supabase } from '../config/supabase';

const BUCKET_NAME = 'crop-images';

export async function uploadImage(file, userId) {
  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function saveUploadRecord(userId, imageUrl) {
  const { data, error } = await supabase
    .from('uploads')
    .insert([{
      user_id: userId,
      image_url: imageUrl
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveResult(uploadId, result) {
  const { data, error } = await supabase
    .from('results')
    .insert([{
      upload_id: uploadId,
      disease: result.disease,
      symptoms: result.symptoms,
      remedy: result.remedy,
      prevention: result.prevention,
      confidence: result.confidence
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getHistory(userId) {
  const { data, error } = await supabase
    .from('uploads')
    .select(`
      *,
      results (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export function getLocalImageUrl(file) {
  return URL.createObjectURL(file);
}

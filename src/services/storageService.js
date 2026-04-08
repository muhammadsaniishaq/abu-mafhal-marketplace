// src/services/storageService.js
import { supabase } from '../config/supabase';

// Upload profile image
export const uploadProfileImage = async (userId, file) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExtension}`;
    const filePath = `profiles/${userId}/${fileName}`;

    const { error } = await supabase.storage
      .from('profiles')
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage.from('profiles').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading profile image:', error.message);
    throw error;
  }
};

// Upload product images
export const uploadProductImages = async (vendorId, productId, files) => {
  try {
    const uploadPromises = files.map(async (file, index) => {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${productId}_${index}_${Date.now()}.${fileExtension}`;
      const filePath = `products/${vendorId}/${productId}/${fileName}`;

      const { error } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (error) throw error;

      const { data } = supabase.storage.from('products').getPublicUrl(filePath);
      return data.publicUrl;
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading product images:', error.message);
    throw error;
  }
};

// Upload vendor document
export const uploadVendorDocument = async (vendorId, file, documentType) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${documentType}_${Date.now()}.${fileExtension}`;
    const filePath = `vendors/${vendorId}/documents/${fileName}`;

    const { error } = await supabase.storage
      .from('vendors')
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage.from('vendors').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading vendor document:', error.message);
    throw error;
  }
};

// Upload chat attachment
export const uploadChatAttachment = async (chatId, file) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExtension}`;
    const filePath = `chat/${chatId}/${fileName}`;

    const { error } = await supabase.storage
      .from('chat')
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage.from('chat').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading chat attachment:', error.message);
    throw error;
  }
};

// Upload dispute evidence
export const uploadDisputeEvidence = async (disputeId, file) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `evidence_${Date.now()}.${fileExtension}`;
    const filePath = `disputes/${disputeId}/${fileName}`;

    const { error } = await supabase.storage
      .from('disputes')
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage.from('disputes').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading dispute evidence:', error.message);
    throw error;
  }
};

// Delete file from storage
export const deleteFile = async (bucket, path) => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting file:', error.message);
    throw error;
  }
};

// Get all files in a folder
export const listFiles = async (bucket, folderPath) => {
  try {
    const { data: fileList, error } = await supabase.storage
      .from(bucket)
      .list(folderPath);
      
    if (error) throw error;
    
    const urls = fileList.map(item => {
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(`${folderPath ? folderPath + '/' : ''}${item.name}`);
        
      return {
        name: item.name,
        url: data.publicUrl,
        path: `${folderPath ? folderPath + '/' : ''}${item.name}`
      };
    });
    
    return urls;
  } catch (error) {
    console.error('Error listing files:', error.message);
    throw error;
  }
};

// Validate file size
export const validateFileSize = (file, maxSizeMB = 5) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size must be less than ${maxSizeMB}MB`);
  }
  return true;
};

// Validate file type
export const validateFileType = (file, allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']) => {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type must be one of: ${allowedTypes.join(', ')}`);
  }
  return true;
};

// Compress image before upload (optional)
export const compressImage = async (file, maxWidth = 1200, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: file.type }));
          },
          file.type,
          quality
        );
      };
      
      img.onerror = (error) => reject(error);
    };
    
    reader.onerror = (error) => reject(error);
  });
};
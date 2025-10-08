// src/services/storageService.js
import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll
} from 'firebase/storage';
import { storage } from '../config/firebase';

// Upload profile image
export const uploadProfileImage = async (userId, file, onProgress) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `profiles/${userId}/${fileName}`);

    if (onProgress) {
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error) => reject(error),
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });
    } else {
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    }
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw error;
  }
};

// Upload product images
export const uploadProductImages = async (vendorId, productId, files, onProgress) => {
  try {
    const uploadPromises = files.map(async (file, index) => {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${productId}_${index}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `products/${vendorId}/${productId}/${fileName}`);

      if (onProgress) {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        return new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress(index, progress);
            },
            (error) => reject(error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      } else {
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
      }
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading product images:', error);
    throw error;
  }
};

// Upload vendor documents (business registration, ID, etc.)
export const uploadVendorDocument = async (vendorId, file, documentType) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${documentType}_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `vendors/${vendorId}/documents/${fileName}`);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading vendor document:', error);
    throw error;
  }
};

// Upload chat attachment
export const uploadChatAttachment = async (chatId, file) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `chat/${chatId}/${fileName}`);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading chat attachment:', error);
    throw error;
  }
};

// Upload dispute evidence
export const uploadDisputeEvidence = async (disputeId, file) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `evidence_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `disputes/${disputeId}/${fileName}`);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading dispute evidence:', error);
    throw error;
  }
};

// Delete file from storage
export const deleteFile = async (fileUrl) => {
  try {
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

// Delete all product images
export const deleteProductImages = async (vendorId, productId) => {
  try {
    const folderRef = ref(storage, `products/${vendorId}/${productId}`);
    const fileList = await listAll(folderRef);
    
    const deletePromises = fileList.items.map(itemRef => deleteObject(itemRef));
    await Promise.all(deletePromises);
    
    return true;
  } catch (error) {
    console.error('Error deleting product images:', error);
    throw error;
  }
};

// Get all files in a folder
export const listFiles = async (path) => {
  try {
    const folderRef = ref(storage, path);
    const fileList = await listAll(folderRef);
    
    const urls = await Promise.all(
      fileList.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          url: url,
          path: itemRef.fullPath
        };
      })
    );
    
    return urls;
  } catch (error) {
    console.error('Error listing files:', error);
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
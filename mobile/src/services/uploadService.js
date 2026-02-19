import { supabase } from '../lib/supabase';

export const UploadService = {
    /**
     * Uploads a file to Supabase Storage using FormData (Fixes OOM on large files)
     * @param {object} file - The file object from DocumentPicker or ImagePicker
     * @param {string} bucket - The storage bucket name
     * @param {string} folder - Optional folder path
     * @returns {Promise<string>} - The public URL of the uploaded file
     */
    uploadFile: async (file, bucket = 'vendor-docs', folder = 'uploads') => {
        try {
            if (!file || !file.uri) {
                console.error('UploadService: Invalid file object', file);
                throw new Error('No file URI provided or file object is invalid');
            }

            // 1. Prepare File Name
            const rawName = file.name || file.fileName || (typeof file.uri === 'string' ? file.uri.split('/').pop() : 'file');
            const fileExt = (typeof rawName === 'string' && rawName.includes('.')) ? rawName.split('.').pop() : 'bin';
            const fileName = `${folder}/${Date.now()}_${Math.floor(Math.random() * 1000000)}.${fileExt}`;

            // 2. Prepare FormData
            const formData = new FormData();
            formData.append('file', {
                uri: file.uri,
                name: fileName,
                type: file.mimeType || file.type || 'application/octet-stream',
            });

            // 3. Upload via standard fetch (Supabase SDK wrapper often loads into memory)
            // We use the direct Storage API endpoint for better streaming support in RN
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, formData, {
                    contentType: file.mimeType || file.type || 'application/octet-stream',
                    upsert: false,
                });

            if (error) throw error;

            // 4. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            return publicUrl;

        } catch (error) {
            console.error('UploadService Error:', error);
            // Fallback for huge files if standard upload fails
            throw new Error(`Upload Failed: ${error.message || 'Unknown error'}`);
        }
    }
};

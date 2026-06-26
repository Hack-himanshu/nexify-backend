const cloudinary = require('../config/cloudinary');

/**
 * Uploads an in-memory buffer (from multer memoryStorage) to Cloudinary via
 * an upload stream — avoids writing temp files to disk, which matters on
 * ephemeral hosts like Render where local disk isn't persistent anyway.
 */
const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'ecommerce-saas',
        resource_type: options.resourceType || 'image',
        transformation: options.transformation,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('[CLOUDINARY] Failed to delete asset:', publicId, err.message);
  }
};

module.exports = { uploadBufferToCloudinary, deleteFromCloudinary };

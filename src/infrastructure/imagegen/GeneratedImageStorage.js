const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * GeneratedImageStorage
 *
 * Persists generated image bytes to disk under src/demo/generated/ and
 * returns the public URL path so Twilio can fetch the image.
 */
class GeneratedImageStorage {
  /**
   * @param {{
   *   storageDir: string,   // absolute path to the generated/ directory
   *   publicBasePath?: string  // URL prefix, defaults to '/generated'
   * }} options
   */
  constructor({ storageDir, publicBasePath = '/generated' }) {
    this.storageDir = storageDir;
    this.publicBasePath = publicBasePath;
  }

  async ensureDir() {
    await fs.mkdir(this.storageDir, { recursive: true });
  }

  /**
   * Save image bytes and return metadata.
   *
   * @param {{
   *   imageBytes: Buffer,
   *   mimeType: string,
   *   userId: string,
   *   productId: string
   * }} params
   * @returns {Promise<{ fileName: string, storedPath: string, urlPath: string }>}
   */
  async save({ imageBytes, mimeType, userId, productId }) {
    await this.ensureDir();

    const ext = mimeTypeToExtension(mimeType);
    const safeUserId = sanitize(userId);
    const safeProductId = sanitize(productId);
    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    const fileName = `${safeUserId}-${safeProductId}-${Date.now()}-${uniqueSuffix}.${ext}`;
    const storedPath = path.join(this.storageDir, fileName);

    await fs.writeFile(storedPath, imageBytes);

    return {
      fileName,
      storedPath,
      urlPath: `${this.publicBasePath}/${fileName}`,
    };
  }
}

function mimeTypeToExtension(mimeType) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

function sanitize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'unknown';
}

module.exports = { GeneratedImageStorage };

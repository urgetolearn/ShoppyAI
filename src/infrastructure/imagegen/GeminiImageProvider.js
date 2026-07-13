const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * GeminiImageProvider
 *
 * Generates a lifestyle image using the Gemini imagen model.
 * Accepts an optional profile photo (as a local file path) to personalise
 * the generation.
 *
 * Returns raw PNG/JPEG bytes on success.
 */
class GeminiImageProvider {
  /**
   * @param {{ apiKey?: string }} options
   */
  constructor({ apiKey } = {}) {
    this.apiKey = apiKey ?? process.env.GEMINI_API_KEY;
    this._client = null;
  }

  _getClient() {
    if (!this._client) {
      if (!this.apiKey) {
        throw new Error('GEMINI_API_KEY is required for image generation.');
      }
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      this._client = new GoogleGenerativeAI(this.apiKey);
    }
    return this._client;
  }

  /**
   * Generate a lifestyle image.
   *
   * @param {{
   *   prompt: string,
   *   profilePhotoPath?: string   // absolute local path to the uploaded photo
   * }} params
   * @returns {Promise<{ imageBytes: Buffer, mimeType: string }>}
   */
  async generateImage({ prompt, profilePhotoPath }) {
    const client = this._getClient();

    // Gemini imagen-3.0 via the generateContent API with responseModalities
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash-preview-image-generation',
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // Build parts: text prompt, optionally followed by the profile photo
    const parts = [{ text: prompt }];

    if (profilePhotoPath) {
      try {
        const photoBytes = await fs.readFile(profilePhotoPath);
        const ext = path.extname(profilePhotoPath).toLowerCase();
        const mimeType =
          ext === '.png'
            ? 'image/png'
            : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';

        parts.push({
          inlineData: {
            mimeType,
            data: photoBytes.toString('base64'),
          },
        });

        console.log('🖼️  Profile photo included in generation prompt.');
      } catch (err) {
        // Photo unreadable — continue without it
        console.warn(`Could not read profile photo: ${err.message}`);
      }
    }

    const result = await model.generateContent(parts);
    const response = result.response;

    // Extract the first image part from the candidates
    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType ?? 'image/png';
          const imageBytes = Buffer.from(part.inlineData.data, 'base64');
          return { imageBytes, mimeType };
        }
      }
    }

    throw new Error('Gemini did not return an image in the response.');
  }
}

module.exports = { GeminiImageProvider };

const fs = require('node:fs/promises');
const https = require('node:https');
const path = require('node:path');

/**
 * FluxImageProvider
 *
 * Generates a lifestyle image using the FLUX.1 Kontext [pro] model via the
 * Replicate API.  The model is an image-editing model: when a profile photo
 * is provided it is used as the reference image so the output reflects the
 * user's real appearance / style.  Without a profile photo the model falls
 * back to pure text-to-image behaviour using the same prompt.
 *
 * Provider interface (same as GeminiImageProvider):
 *   generateImage({ prompt, profilePhotoPath? })
 *     → Promise<{ imageBytes: Buffer, mimeType: string }>
 */
class FluxImageProvider {
  /**
   * @param {{ apiToken?: string }} options
   */
  constructor({ apiToken } = {}) {
    this.apiToken = apiToken ?? process.env.REPLICATE_API_TOKEN;
    this._replicate = null;
  }

  _getClient() {
    if (!this._replicate) {
      if (!this.apiToken) {
        throw new Error('REPLICATE_API_TOKEN is required for image generation.');
      }
      const Replicate = require('replicate');
      this._replicate = new Replicate({ auth: this.apiToken });
    }
    return this._replicate;
  }

  /**
   * @param {{
   *   prompt: string,
   *   profilePhotoPath?: string   // absolute local path to the uploaded photo
   * }} params
   * @returns {Promise<{ imageBytes: Buffer, mimeType: string }>}
   */
  async generateImage({ prompt, profilePhotoPath }) {
    const replicate = this._getClient();

    // Build the model input
    const input = {
      prompt,
      output_format: 'jpg',
      aspect_ratio: 'match_input_image',
      safety_tolerance: 2,
    };

    // Attach the profile photo as a data URI when available
    if (profilePhotoPath) {
      try {
        const photoBytes = await fs.readFile(profilePhotoPath);
        const ext = path.extname(profilePhotoPath).toLowerCase();
        const mimeType =
          ext === '.png'  ? 'image/png'  :
          ext === '.webp' ? 'image/webp' :
          ext === '.gif'  ? 'image/gif'  :
          'image/jpeg';

        input.input_image = `data:${mimeType};base64,${photoBytes.toString('base64')}`;
        console.log('🖼️  Profile photo attached as reference image for Flux generation.');
      } catch (err) {
        // Unreadable photo — proceed as text-only; Kontext still works well
        console.warn(`Could not read profile photo (will generate without it): ${err.message}`);
        // Remove aspect_ratio hint — no input image means no reference size
        input.aspect_ratio = '1:1';
        delete input.input_image;
      }
    } else {
      // No profile photo — generate a square lifestyle image from prompt alone
      input.aspect_ratio = '1:1';
    }

    console.log('Calling Replicate FLUX.1 Kontext [pro]...');
    const outputUrl = await replicate.run('black-forest-labs/flux-kontext-pro', { input });

    if (!outputUrl) {
      throw new Error('Replicate returned an empty response.');
    }

    // outputUrl is a string URI — download the bytes so the rest of the
    // pipeline (GeneratedImageStorage) can persist them locally.
    const url = String(outputUrl);
    const imageBytes = await downloadUrl(url);
    const mimeType = url.endsWith('.png') ? 'image/png' : 'image/jpeg';

    return { imageBytes, mimeType };
  }
}

/**
 * Download a URL to a Buffer using only the Node built-ins (no extra deps).
 *
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : require('node:http').get;
    get(url, (res) => {
      // Follow a single redirect (Replicate CDN often 302s)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadUrl(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Image download failed with HTTP ${res.statusCode}: ${url}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = { FluxImageProvider };

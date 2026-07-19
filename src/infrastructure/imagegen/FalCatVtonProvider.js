'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');

/**
 * FalCatVtonProvider
 *
 * Generates an upper-body virtual try-on image using the CatVTON model hosted
 * on fal.ai (fal-ai/cat-vton).
 *
 * Interface contract — identical to FluxImageProvider:
 *
 *   generateImage({ profilePhotoPath, garmentImagePath, prompt })
 *     → Promise<{ imageBytes: Buffer, mimeType: string }>
 *
 * The provider:
 *  1. Reads both local image files into Blobs.
 *  2. Passes them as `human_image_url` / `garment_image_url` inside the fal
 *     input object. The SDK's `storage.transformInput` step auto-uploads any
 *     Blob value to fal CDN before the queue request is dispatched.
 *  3. Polls the queue via `fal.subscribe` until the result is ready.
 *  4. Downloads the output image and returns raw bytes + mimeType.
 *
 * Required env var:
 *   FAL_KEY — your fal.ai API key (https://fal.ai/dashboard/keys)
 *
 * Optional env var:
 *   VTON_NUM_INFERENCE_STEPS — integer, default 30
 *   VTON_GUIDANCE_SCALE      — float,   default 2.5
 *   VTON_SEED                — integer, omitted by default (random)
 */
class FalCatVtonProvider {
  /**
   * @param {{ apiKey?: string }} options
   *   apiKey — fal.ai API key. Falls back to FAL_KEY env var if omitted.
   */
  constructor({ apiKey } = {}) {
    this.apiKey = apiKey ?? process.env.FAL_KEY ?? null;
  }

  /**
   * Lazy-initialise the fal client so we only configure credentials once and
   * only when the provider is actually used.
   *
   * @returns {import('@fal-ai/client').FalClient}
   */
  _getClient() {
    if (!this._fal) {
      if (!this.apiKey) {
        throw new Error(
          'FalCatVtonProvider: FAL_KEY is required. ' +
          'Set it in .env or pass apiKey to the constructor.'
        );
      }

      const { fal } = require('@fal-ai/client');

      // Configure credentials on the shared singleton.
      // This is idempotent — re-configuring with the same key is harmless.
      fal.config({ credentials: this.apiKey });

      this._fal = fal;
    }

    return this._fal;
  }

  /**
   * Generate a virtual try-on image.
   *
   * @param {{
   *   profilePhotoPath: string,   // absolute path to the person image (uploaded profile photo)
   *   garmentImagePath: string,   // absolute path to the garment flat-lay image (product asset)
   *   prompt?: string             // unused by CatVTON but kept for interface compatibility
   * }} params
   *
   * @returns {Promise<{ imageBytes: Buffer, mimeType: string }>}
   *
   * @throws {Error} if either image path is missing or unreadable, if the
   *   fal.ai API call fails, or if the response contains no image.
   */
  async generateImage({ profilePhotoPath, garmentImagePath, prompt }) {
    if (!profilePhotoPath) {
      throw new Error(
        'FalCatVtonProvider: profilePhotoPath is required. ' +
        'CatVTON needs a person image to perform virtual try-on.'
      );
    }

    if (!garmentImagePath) {
      throw new Error(
        'FalCatVtonProvider: garmentImagePath is required. ' +
        'CatVTON needs a garment image to perform virtual try-on.'
      );
    }

    // ------------------------------------------------------------------
    // 1. Read both images from disk into Blobs.
    //    The fal SDK's storage.transformInput() auto-uploads any Blob it
    //    finds in the input object to fal CDN and replaces the Blob with
    //    the resulting URL before the queue request is submitted.
    // ------------------------------------------------------------------
    const [personBytes, garmentBytes] = await Promise.all([
      readFileOrThrow(profilePhotoPath, 'person image (profilePhotoPath)'),
      readFileOrThrow(garmentImagePath, 'garment image (garmentImagePath)'),
    ]);

    const personBlob  = new Blob([personBytes],  { type: mimeTypeFromPath(profilePhotoPath) });
    const garmentBlob = new Blob([garmentBytes], { type: mimeTypeFromPath(garmentImagePath) });

    console.log(
      `🧵 FalCatVton: running try-on — ` +
      `person=${path.basename(profilePhotoPath)}, ` +
      `garment=${path.basename(garmentImagePath)}`
    );

    // ------------------------------------------------------------------
    // 2. Build the model input.
    //    CatVTON schema (fal-ai/cat-vton):
    //      human_image_url   — URL or Blob  (required)
    //      garment_image_url — URL or Blob  (required)
    //      cloth_type        — 'upper' | 'lower' | 'overall' | 'inner' | 'outer'
    //      image_size        — enum or { width, height }
    //      num_inference_steps — integer (default 30)
    //      guidance_scale    — float   (default 2.5)
    //      seed              — integer (optional)
    // ------------------------------------------------------------------
    const numInferenceSteps = parseIntEnv('VTON_NUM_INFERENCE_STEPS', 30);
    const guidanceScale     = parseFloatEnv('VTON_GUIDANCE_SCALE', 2.5);
    const seed              = parseIntEnv('VTON_SEED', null);

    const input = {
      human_image_url:   personBlob,
      garment_image_url: garmentBlob,
      cloth_type:        'upper',       // upper-body only per MVP scope
      image_size:        'portrait_4_3',
      num_inference_steps: numInferenceSteps,
      guidance_scale:    guidanceScale,
      ...(seed !== null && { seed }),
    };

    // ------------------------------------------------------------------
    // 3. Submit to the fal.ai queue and wait for completion.
    //    fal.subscribe = submit → poll status → fetch result.
    //    Any Blob in `input` is uploaded by transformInput before submit.
    // ------------------------------------------------------------------
    const fal = this._getClient();

    let result;
    try {
      result = await fal.subscribe('fal-ai/cat-vton', {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_QUEUE') {
            console.log(`   fal queue position: ${update.queue_position ?? 'unknown'}`);
          } else if (update.status === 'IN_PROGRESS') {
            const msgs = (update.logs ?? []).map((l) => l.message).filter(Boolean);
            if (msgs.length > 0) {
              console.log(`   fal progress: ${msgs.at(-1)}`);
            }
          }
        },
      });
    } catch (err) {
      throw new Error(
        `FalCatVtonProvider: fal.ai API call failed — ${err.message ?? err}`
      );
    }

    // ------------------------------------------------------------------
    // 4. Extract the output image URL.
    //    CatVTON response schema: { data: { image: { url, content_type, ... } } }
    // ------------------------------------------------------------------
    const imageData = result?.data?.image;

    if (!imageData?.url) {
      throw new Error(
        `FalCatVtonProvider: unexpected response shape — no image URL. ` +
        `Full response: ${JSON.stringify(result)}`
      );
    }

    const outputUrl  = imageData.url;
    const outputMime = imageData.content_type ?? 'image/png';

    console.log(`✅ FalCatVton: image generated — ${outputUrl}`);

    // ------------------------------------------------------------------
    // 5. Download the result image to a Buffer.
    // ------------------------------------------------------------------
    const imageBytes = await downloadToBuffer(outputUrl);

    return { imageBytes, mimeType: outputMime };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a file and throw a descriptive error if it cannot be read.
 *
 * @param {string} filePath
 * @param {string} label  human-readable name for error messages
 * @returns {Promise<Buffer>}
 */
async function readFileOrThrow(filePath, label) {
  try {
    return await fs.readFile(filePath);
  } catch (err) {
    throw new Error(
      `FalCatVtonProvider: could not read ${label} at "${filePath}" — ${err.message}`
    );
  }
}

/**
 * Derive a MIME type from a file extension.
 *
 * @param {string} filePath
 * @returns {string}
 */
function mimeTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':  return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif':  return 'image/gif';
    default:      return 'image/jpeg';
  }
}

/**
 * Download a URL to a Buffer, following up to one redirect.
 *
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https://') ? https.get : http.get;

    get(url, (res) => {
      // Follow a single redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadToBuffer(res.headers.location).then(resolve, reject);
      }

      if (res.statusCode !== 200) {
        return reject(
          new Error(`FalCatVtonProvider: image download failed with HTTP ${res.statusCode}: ${url}`)
        );
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Parse an integer from an env var, returning a default if absent or invalid.
 *
 * @param {string} key
 * @param {number|null} defaultValue
 * @returns {number|null}
 */
function parseIntEnv(key, defaultValue) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Parse a float from an env var, returning a default if absent or invalid.
 *
 * @param {string} key
 * @param {number} defaultValue
 * @returns {number}
 */
function parseFloatEnv(key, defaultValue) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

module.exports = { FalCatVtonProvider };

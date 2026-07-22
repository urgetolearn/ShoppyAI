'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');

/**
 * FashnVtonProvider
 *
 * Generates an upper-body virtual try-on image using the FASHN VTON 1.5 model
 * running in Google Colab, exposed via a Cloudflare tunnel.
 *
 * Interface contract — identical to FalCatVtonProvider:
 *
 *   generateImage({ profilePhotoPath, garmentImagePath, prompt })
 *     → Promise<{ imageBytes: Buffer, mimeType: string }>
 *
 * The provider:
 *  1. Reads both local image files and encodes them as base64.
 *  2. POSTs { person_image_b64, garment_image_b64, category } to the
 *     tunnel URL's /try-on endpoint.
 *  3. Decodes the base64 result image from the response.
 *  4. Returns raw bytes + mimeType.
 *
 * Required env var:
 *   FASHN_TUNNEL_URL — the public Cloudflare tunnel URL printed by your Colab
 *                      notebook, e.g. https://xxxx-xx-xx.trycloudflare.com
 *                      (no trailing slash)
 *
 * Optional env vars:
 *   VTON_CATEGORY    — 'tops' | 'bottoms' | 'one-pieces', default 'tops'
 *
 * TODO (Colab): Start fashn_api_server.py in your Colab notebook and paste
 *              the printed tunnel URL into FASHN_TUNNEL_URL in .env before
 *              starting the Node server.
 */
class FashnVtonProvider {
  /**
   * @param {{ tunnelUrl?: string }} options
   *   tunnelUrl — Cloudflare tunnel base URL. Falls back to FASHN_TUNNEL_URL env var.
   */
  constructor({ tunnelUrl } = {}) {
    this.tunnelUrl = (tunnelUrl ?? process.env.FASHN_TUNNEL_URL ?? '').replace(/\/$/, '');
  }

  /**
   * Generate a virtual try-on image.
   *
   * @param {{
   *   profilePhotoPath: string,   // absolute path to the person image
   *   garmentImagePath: string,   // absolute path to the garment flat-lay image
   *   prompt?: string             // unused by FASHN VTON but kept for interface compatibility
   * }} params
   *
   * @returns {Promise<{ imageBytes: Buffer, mimeType: string }>}
   */
  async generateImage({ profilePhotoPath, garmentImagePath, prompt }) {
    if (!this.tunnelUrl) {
      throw new Error(
        'FashnVtonProvider: FASHN_TUNNEL_URL is not set. ' +
        'Start fashn_api_server.py in Colab, copy the printed tunnel URL, ' +
        'and add it to .env as FASHN_TUNNEL_URL=https://xxxx.trycloudflare.com'
      );
    }

    if (!profilePhotoPath) {
      throw new Error('FashnVtonProvider: profilePhotoPath is required.');
    }

    if (!garmentImagePath) {
      throw new Error('FashnVtonProvider: garmentImagePath is required.');
    }

    // ------------------------------------------------------------------
    // 1. Read both images from disk and base64-encode them.
    // ------------------------------------------------------------------
    const [personBytes, garmentBytes] = await Promise.all([
      readFileOrThrow(profilePhotoPath, 'person image (profilePhotoPath)'),
      readFileOrThrow(garmentImagePath, 'garment image (garmentImagePath)'),
    ]);

    const personB64  = personBytes.toString('base64');
    const garmentB64 = garmentBytes.toString('base64');
    const category   = process.env.VTON_CATEGORY ?? 'tops';

    console.log(
      `🧵 FashnVton: running try-on — ` +
      `person=${path.basename(profilePhotoPath)}, ` +
      `garment=${path.basename(garmentImagePath)}, ` +
      `category=${category}`
    );

    // ------------------------------------------------------------------
    // 2. POST to the Colab Flask server via the Cloudflare tunnel.
    //    Expected request body:
    //      { person_image_b64: string, garment_image_b64: string, category: string }
    //    Expected response body:
    //      { result_image_b64: string, mime_type: string }
    //
    // TODO (Colab): ensure fashn_api_server.py is running and the tunnel
    //               URL in .env matches the URL printed in your Colab cell.
    // ------------------------------------------------------------------
    const endpoint = `${this.tunnelUrl}/try-on`;
    const body = JSON.stringify({
      person_image_b64: personB64,
      garment_image_b64: garmentB64,
      category,
    });

    let responseJson;
    try {
      responseJson = await postJson(endpoint, body);
    } catch (err) {
      throw new Error(
        `FashnVtonProvider: request to Colab tunnel failed — ${err.message}\n` +
        `Endpoint: ${endpoint}\n` +
        `Is fashn_api_server.py running in Colab? Is FASHN_TUNNEL_URL current?`
      );
    }

    // ------------------------------------------------------------------
    // 3. Decode the base64 result.
    // ------------------------------------------------------------------
    if (!responseJson.result_image_b64) {
      throw new Error(
        `FashnVtonProvider: unexpected response — no result_image_b64. ` +
        `Full response: ${JSON.stringify(responseJson)}`
      );
    }

    const imageBytes = Buffer.from(responseJson.result_image_b64, 'base64');
    const mimeType   = responseJson.mime_type ?? 'image/png';

    console.log(`✅ FashnVton: try-on complete — ${imageBytes.length} bytes, ${mimeType}`);

    return { imageBytes, mimeType };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a file and throw a descriptive error if unreadable.
 *
 * @param {string} filePath
 * @param {string} label
 * @returns {Promise<Buffer>}
 */
async function readFileOrThrow(filePath, label) {
  try {
    return await fs.readFile(filePath);
  } catch (err) {
    throw new Error(
      `FashnVtonProvider: could not read ${label} at "${filePath}" — ${err.message}`
    );
  }
}

/**
 * POST a JSON body to a URL and return the parsed response JSON.
 * Follows a single redirect. Rejects on non-2xx status.
 *
 * @param {string} url
 * @param {string} body  — already-serialised JSON string
 * @returns {Promise<object>}
 */
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps   = parsedUrl.protocol === 'https:';
    const lib       = isHttps ? https : http;

    const options = {
      method:   'POST',
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (isHttps ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        // Cloudflare tunnels reject requests without a valid User-Agent header
        'User-Agent':     'ShoppyAI/1.0',
      },
    };

    const req = lib.request(options, (res) => {
      // Follow a single redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return postJson(res.headers.location, body).then(resolve, reject);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        // Drain the body so the socket is released
        res.resume();
        return reject(
          new Error(`HTTP ${res.statusCode} from ${url}`)
        );
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (parseErr) {
          reject(new Error(`Failed to parse JSON response: ${parseErr.message}`));
        }
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { FashnVtonProvider };

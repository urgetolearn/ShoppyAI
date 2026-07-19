/**
 * StyleVisualizationService
 *
 * Orchestrates virtual try-on image creation for a product + user.
 *
 * Flow:
 *  1. Build a text prompt from product + preferences (passed as `prompt` for
 *     providers that use it; ignored by CatVTON which is purely image-based).
 *  2. Resolve the garment image path from the product's local asset file.
 *  3. Call the image provider with profilePhotoPath, garmentImagePath, prompt.
 *  4. Save the result via GeneratedImageStorage.
 *  5. Return a full public URL.
 *
 * Any error is caught here — callers always receive null on failure so the
 * pipeline falls back to the product's static asset image.
 */
class StyleVisualizationService {
  /**
   * @param {{
   *   promptBuilder: import('./PromptBuilder').PromptBuilder,
   *   imageProvider: object,  // any provider implementing generateImage()
   *   imageStorage: import('../infrastructure/imagegen/GeneratedImageStorage').GeneratedImageStorage,
   *   publicBaseUrl: string,
   *   assetsDir?: string      // absolute path to src/demo/assets — used to
   *                           // resolve garment image paths from product.imageUrl.
   *                           // When null/undefined the garmentImagePath passed
   *                           // to the provider will be undefined (providers that
   *                           // don't need it, e.g. FluxImageProvider, ignore it).
   * }} options
   */
  constructor({ promptBuilder, imageProvider, imageStorage, publicBaseUrl, assetsDir = null }) {
    this.promptBuilder = promptBuilder;
    this.imageProvider = imageProvider;
    this.imageStorage = imageStorage;
    this.publicBaseUrl = publicBaseUrl;
    this.assetsDir = assetsDir;
  }

  /**
   * Generate a try-on image and return its public URL.
   *
   * @param {{
   *   user: object,
   *   product: object,
   *   preferences?: object
   * }} params
   * @returns {Promise<string|null>} Public URL string, or null if generation failed.
   */
  async generateImageUrl({ user, product, preferences = {} }) {
    try {
      // ----------------------------------------------------------------
      // Profile photo — uploaded by the user via /api/profile/photo
      // ----------------------------------------------------------------
      const profilePhotoPath = user?.profile?.photo?.storedPath ?? null;

      // ----------------------------------------------------------------
      // Garment image — resolve the product's asset to an absolute path.
      // product.imageUrl is a URL path like /assets/navy-denim-jacket.png.
      // We strip the leading path segment and join with assetsDir.
      // ----------------------------------------------------------------
      let garmentImagePath;
      if (this.assetsDir && product?.imageUrl) {
        const fileName = require('node:path').basename(product.imageUrl);
        garmentImagePath = require('node:path').join(this.assetsDir, fileName);
      }

      // ----------------------------------------------------------------
      // Build the text prompt (used by generative providers; CatVTON
      // ignores it, but we keep it for interface compatibility).
      // ----------------------------------------------------------------
      const prompt = this.promptBuilder.buildImagePrompt({
        product,
        preferences,
        profilePhotoDescription: profilePhotoPath
          ? this.promptBuilder.describeProfilePhoto(user.profile)
          : null,
      });

      console.log(`🎨 Generating try-on image for "${product.title}"...`);
      if (profilePhotoPath) {
        console.log(`   Person image : ${profilePhotoPath}`);
      }
      if (garmentImagePath) {
        console.log(`   Garment image: ${garmentImagePath}`);
      }

      // ----------------------------------------------------------------
      // Generate — pass all three params; each provider uses what it needs
      // ----------------------------------------------------------------
      const { imageBytes, mimeType } = await this.imageProvider.generateImage({
        profilePhotoPath: profilePhotoPath ?? undefined,
        garmentImagePath: garmentImagePath ?? undefined,
        prompt,
      });

      // ----------------------------------------------------------------
      // Persist and return the full public URL
      // ----------------------------------------------------------------
      const { urlPath } = await this.imageStorage.save({
        imageBytes,
        mimeType,
        userId: user.id,
        productId: product.id,
      });

      const fullUrl = new URL(urlPath, this.publicBaseUrl).toString();
      console.log(`✅ Generated image saved: ${fullUrl}`);
      return fullUrl;
    } catch (err) {
      console.warn(`⚠️  Style visualization failed for "${product?.title}": ${err.message}`);
      return null;
    }
  }
}

module.exports = { StyleVisualizationService };

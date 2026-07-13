/**
 * StyleVisualizationService
 *
 * Orchestrates AI-generated lifestyle image creation for a product + user.
 *
 * Flow:
 *  1. Build a prompt from product + preferences (+ optional profile photo)
 *  2. Call GeminiImageProvider to generate the image
 *  3. Save via GeneratedImageStorage
 *  4. Return a full public URL using publicBaseUrl
 *
 * Any error is caught here — callers always get null on failure so they
 * can fall back to the product asset image.
 */
class StyleVisualizationService {
  /**
   * @param {{
   *   promptBuilder: import('./PromptBuilder').PromptBuilder,
   *   imageProvider: import('../infrastructure/imagegen/GeminiImageProvider').GeminiImageProvider,
   *   imageStorage: import('../infrastructure/imagegen/GeneratedImageStorage').GeneratedImageStorage,
   *   publicBaseUrl: string
   * }} options
   */
  constructor({ promptBuilder, imageProvider, imageStorage, publicBaseUrl }) {
    this.promptBuilder = promptBuilder;
    this.imageProvider = imageProvider;
    this.imageStorage = imageStorage;
    this.publicBaseUrl = publicBaseUrl;
  }

  /**
   * Generate a lifestyle image and return its public URL.
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
      // Resolve the uploaded profile photo path (if any)
      const profilePhotoPath = user?.profile?.photo?.storedPath ?? null;
      const hasProfilePhoto = Boolean(profilePhotoPath);

      // Build the generation prompt
      const prompt = this.promptBuilder.buildImagePrompt({
        product,
        preferences,
        profilePhotoDescription: hasProfilePhoto
          ? this.promptBuilder.describeProfilePhoto(user.profile)
          : null,
      });

      console.log(`🎨 Generating lifestyle image for "${product.title}"...`);
      if (hasProfilePhoto) {
        console.log(`   Using profile photo: ${profilePhotoPath}`);
      }

      // Generate
      const { imageBytes, mimeType } = await this.imageProvider.generateImage({
        prompt,
        profilePhotoPath: profilePhotoPath ?? undefined,
      });

      // Persist
      const { urlPath } = await this.imageStorage.save({
        imageBytes,
        mimeType,
        userId: user.id,
        productId: product.id,
      });

      // Build full public URL
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

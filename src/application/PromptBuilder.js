/**
 * PromptBuilder
 *
 * Builds a Gemini image-generation prompt for a lifestyle visualization
 * inspired by the user's uploaded style photo and the product they're
 * interested in.
 */
class PromptBuilder {
  /**
   * @param {{
   *   product: import('../domain/models/Product').Product,
   *   preferences?: object,
   *   profilePhotoDescription?: string
   * }} params
   * @returns {string}
   */
  buildImagePrompt({ product, preferences = {}, profilePhotoDescription }) {
    const title = product.title ?? 'clothing item';
    const category = product.metadata?.category ?? 'clothing';
    const color = product.metadata?.color ?? product.metadata?.tags?.[0] ?? '';
    const colorLabel = color ? `${color} ` : '';

    // Preference context
    const preferredColors = (preferences.favouriteColors ?? []).join(', ');
    const preferredCategories = (preferences.favouriteCategories ?? []).join(', ');

    const styleHints = [
      preferredColors && `The person tends to wear ${preferredColors} tones.`,
      preferredCategories && `Their usual style includes ${preferredCategories}.`,
    ]
      .filter(Boolean)
      .join(' ');

    // Profile photo context
    const photoContext = profilePhotoDescription
      ? `Draw inspiration from the following description of the shopper's personal style: ${profilePhotoDescription}.`
      : 'The person has a casual, modern lifestyle aesthetic.';

    return [
      `Create a photorealistic lifestyle fashion photograph.`,
      `A stylish person is wearing or styling a ${colorLabel}${title} — a ${category}.`,
      photoContext,
      styleHints,
      `Show the item in a natural, aspirational setting such as a city street, café, or outdoor space.`,
      `The image should feel like a high-quality shopping inspiration photo.`,
      `Soft natural lighting. Editorial quality. No text or watermarks.`,
      `This is for shopping inspiration only and is not a guarantee of exact appearance.`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Build a short textual description of a profile photo to inject into the
   * image prompt when the raw image bytes are not being sent to the model.
   * Falls back gracefully if no photo info is available.
   *
   * @param {{ photo?: { mimeType?: string, fileName?: string } }} profile
   * @returns {string|null}
   */
  describeProfilePhoto(profile) {
    if (!profile?.photo?.fileName) {
      return null;
    }
    // We don't analyse the photo here — the raw bytes are sent to Gemini
    // directly by GeminiImageProvider. This method is a fallback path only.
    return 'the shopper\'s uploaded style photo';
  }
}

module.exports = { PromptBuilder };

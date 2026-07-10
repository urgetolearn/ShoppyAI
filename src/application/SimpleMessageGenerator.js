class SimpleMessageGenerator {
  generateReminderMessage({ product, interest, preferences = {} }) {
    const productName = product.title.toLowerCase();
    const color = this.findMatchingValue(
      product,
      preferences.favouriteColors,
    );
    const category = this.findMatchingValue(
      product,
      preferences.favouriteCategories,
    );
    const personalizedProduct =
      color && category ? `${color} ${category}` : productName;

    if (interest.interestType === 'repeated_view') {
      return `You've checked ${personalizedProduct} several times lately 👀 This one is still waiting for you.`;
    }

    if (interest.interestType === 'added_to_cart') {
      const determiner = personalizedProduct.endsWith('s') ? 'Those' : 'That';
      const verb = personalizedProduct.endsWith('s') ? 'are' : 'is';
      return `${determiner} ${personalizedProduct} you added to cart ${verb} still waiting for you 👀`;
    }

    if (interest.interestType === 'wishlist') {
      return `That ${productName} from your wishlist still looks like a strong match. Want another look?`;
    }

    if (interest.interestType === 'price_drop') {
      return `Good news — ${productName} had a price drop. It may be worth revisiting.`;
    }

    return `You seemed interested in ${productName}. Want another look?`;
  }

  findMatchingValue(product, values = []) {
    const searchableText = [
      product.title,
      product.description,
      product.metadata?.category,
      ...(product.metadata?.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return values.find((value) => searchableText.includes(value.toLowerCase()));
  }
}

module.exports = { SimpleMessageGenerator };

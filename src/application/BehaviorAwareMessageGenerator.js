class BehaviorAwareMessageGenerator {
    constructor() {
        this.templatePools = {
            repeated_view: [
                "That {product} seems to have caught your eye 👀",
                "Looks like you keep coming back to that {product}.",
                "Still thinking about that {product}? 👀",
                "You've checked out that {product} a few times now.",
                "That {product} is calling your name 👀",
                "Noticed you eyeing that {product} again.",
            ],
            added_to_cart: [
                "Those {product} are still waiting in your cart 👀",
                "You almost picked those {product}. Want another look?",
                "{product} has been patiently waiting in your cart.",
                "Ready to go through with that {product}? 👀",
                "Those {product} won't stay available forever.",
            ],
            wishlist: [
                "You saved that {product} for a reason 😊 Still thinking about it?",
                "That item on your wishlist is patiently waiting.",
                "That {product} you wishlisted is still there for you.",
                "Your wishlist item {product} is looking good 😊",
            ],
            price_drop: [
                "Good news! That {product} just got even more tempting 👀",
                "Price drop alert: The {product} you wanted is now better priced.",
                "Your {product} just became a better deal 👀",
                "The {product} got cheaper. Perfect timing!",
            ],
            high_interest: [
                "That {product} is definitely a keeper 👀",
                "Based on your interest, that {product} might be perfect.",
                "You seemed really interested in that {product}.",
            ],
            preference_match: [
                "This {product} matches your usual style pretty well 👀",
                "Looks like something right up your alley.",
                "That {product} is totally your style 😊",
                "We think you'll love this {product}.",
            ],
            generic: [
                "You seemed interested in that {product}. Want another look?",
                "Still interested in that {product}?",
                "How about that {product}? 👀",
            ],
        };
    }

    /**
     * Select appropriate template pool based on behavior and interest data
     */
    getTemplatePool(product, interest, preferences = {}) {
        const { interestType, score, viewCount } = interest;
        const productName = product.title.toLowerCase();
        const category = product.metadata?.category || '';
        const colors = (product.metadata?.tags || []).filter(tag =>
            tag.toLowerCase().match(/^(red|blue|black|white|green|yellow|pink|purple|orange|brown|gray|navy|gold|silver|bronze)/i)
        );

        // Check if product matches user preferences
        const matchesFavoriteColor = colors.some(color =>
            (preferences.favouriteColors || []).some(fav =>
                fav.toLowerCase() === color.toLowerCase()
            )
        );
        const matchesFavoriteCategory = (preferences.favouriteCategories || []).some(fav =>
            category.toLowerCase().includes(fav.toLowerCase()) ||
            productName.includes(fav.toLowerCase())
        );

        // Determine primary interest type and select pool
        if (interestType === 'price_drop') {
            return this.templatePools.price_drop;
        }

        if (interestType === 'added_to_cart') {
            return this.templatePools.added_to_cart;
        }

        if (interestType === 'wishlist') {
            return this.templatePools.wishlist;
        }

        if (interestType === 'repeated_view' || viewCount >= 3) {
            return this.templatePools.repeated_view;
        }

        if (score >= 8) {
            // High interest score
            if (matchesFavoriteColor || matchesFavoriteCategory) {
                return this.templatePools.preference_match;
            }
            return this.templatePools.high_interest;
        }

        if (matchesFavoriteColor || matchesFavoriteCategory) {
            return this.templatePools.preference_match;
        }

        return this.templatePools.generic;
    }

    /**
     * Pick a random template from the pool
     */
    pickRandomTemplate(templatePool) {
        const randomIndex = Math.floor(Math.random() * templatePool.length);
        return templatePool[randomIndex];
    }

    /**
     * Fill template with product information
     */
    fillTemplate(template, product, preferences = {}) {
        const productName = product.title.toLowerCase();
        const color = this.findMatchingValue(product, preferences.favouriteColors);
        const category = this.findMatchingValue(product, preferences.favouriteCategories);
        const personalizedProduct =
            color && category ? `${color} ${category}` : productName;

        return template.replace(/{product}/g, personalizedProduct);
    }

    /**
     * Find a matching value from product metadata/title
     */
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

        return values.find((value) =>
            searchableText.includes(value.toLowerCase())
        );
    }

    /**
     * Main message generation method
     */
    async generateReminderMessage({ product, interest, preferences = {}, user }) {
        try {
            const templatePool = this.getTemplatePool(product, interest, preferences);
            const template = this.pickRandomTemplate(templatePool);
            const message = this.fillTemplate(template, product, preferences);

            console.log(`Generated personalized message: "${message}"`);
            return message;
        } catch (error) {
            console.error('Error generating personalized message:', error.message);
            // Fallback to a very generic message if something goes wrong
            return `You seemed interested in ${product.title.toLowerCase()}. Want another look?`;
        }
    }
}

module.exports = { BehaviorAwareMessageGenerator };

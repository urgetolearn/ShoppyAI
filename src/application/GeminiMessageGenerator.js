const { GoogleGenerativeAI } = require('@google/generative-ai');
const { SimpleMessageGenerator } = require('./SimpleMessageGenerator');

class GeminiMessageGenerator {
    constructor(apiKey = process.env.GEMINI_API_KEY) {
        if (!apiKey) {
            throw new Error(
                'GEMINI_API_KEY is not set in environment variables. Please add it to .env file.',
            );
        }
        this.client = new GoogleGenerativeAI(apiKey);
        this.modelsToTry = [
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash',
            'gemini-2.5-pro',
        ];
        this.workingModel = null;
        this.fallbackGenerator = new SimpleMessageGenerator();
    }

    async findWorkingModel(prompt) {
        for (const modelName of this.modelsToTry) {
            try {
                console.log(`Trying Gemini model: ${modelName}`);
                const model = this.client.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                    }
                });
                const result = await model.generateContent(prompt);
                console.log(`✓ Model ${modelName} is available and working`);
                this.workingModel = modelName;
                return model;
            } catch (error) {
                console.log(`✗ Model ${modelName} failed: ${error.message}`);
            }
        }
        return null;
    }

    async generateReminderMessage({ product, interest, preferences = {}, user }) {
        try {
            const productName = product.title;
            const price = product.price ? `₹${product.price}` : 'No price info';
            const category = product.metadata?.category || 'item';
            const viewCount = interest.viewCount || 0;
            const timeSpent = interest.timeSpent ? `${interest.timeSpent}s` : 'some time';
            const addedToCart = interest.interestType === 'added_to_cart' ? 'Yes' : 'No';
            const addedToWishlist =
                interest.interestType === 'wishlist' ? 'Yes' : 'No';
            const userPrefs = preferences.favouriteColors?.join(', ') || 'various';

            const prompt = `You are a friendly WhatsApp shopping reminder bot. Generate a single, short reminder message for a customer who has shown interest in a product.

Product Details:
- Name: ${productName}
- Category: ${category}
- Price: ${price}
- View count: ${viewCount}
- Time spent viewing: ${timeSpent}
- Added to cart: ${addedToCart}
- Added to wishlist: ${addedToWishlist}
- User's style preferences: ${userPrefs}

Requirements for the message:
- Maximum 2 sentences
- Use at most one emoji
- Tone: playful, personalized, not creepy, not salesy
- Format: Plain text suitable for WhatsApp
- Do NOT include any markdown, asterisks, or special formatting
- Do NOT address the user by name
- Make it feel like a helpful friend, not a sales bot

Generate only the message, no additional text or explanations.`;

            // Find a working model if we haven't already
            let model = null;
            if (this.workingModel) {
                model = this.client.getGenerativeModel({
                    model: this.workingModel,
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                    }
                });
            } else {
                model = await this.findWorkingModel(prompt);
            }

            // If no working model found, fall back to static generator
            if (!model) {
                console.log('No Gemini model available, falling back to static message generator');
                return this.fallbackGenerator.generateReminderMessage({
                    product,
                    interest,
                    preferences,
                });
            }

            const result = await model.generateContent(prompt);
            const message = result.response.text().trim();

            // Validate that the message is reasonable (not too long, has content)
            if (message.length > 200 || message.length < 10) {
                console.warn('Generated message length out of bounds, using fallback');
                return this.fallbackGenerator.generateReminderMessage({
                    product,
                    interest,
                    preferences,
                });
            }

            return message;
        } catch (error) {
            console.error('Gemini API error:', error.message);
            console.log('Falling back to static message generator');

            // Fall back to simple message generator on any error
            return this.fallbackGenerator.generateReminderMessage({
                product,
                interest,
                preferences,
            });
        }
    }
}

module.exports = { GeminiMessageGenerator };

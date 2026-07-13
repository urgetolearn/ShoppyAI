class NotificationService {
    constructor({ channel = 'console', consoleProvider, whatsappProvider }) {
        this.channel = channel;
        this.consoleProvider = consoleProvider;
        this.whatsappProvider = whatsappProvider;
    }

    async send(channel, user, message, mediaUrl) {
        const effectiveChannel = channel ?? this.channel;

        if (effectiveChannel === 'console') {
            return this.consoleProvider.send('console', user, message, mediaUrl);
        }

        if (effectiveChannel === 'whatsapp') {
            if (!this.whatsappProvider) {
                throw new Error('WhatsApp provider is not configured.');
            }

            const recipient = user?.phone ?? process.env.TWILIO_WHATSAPP_TO;
            if (mediaUrl) {
                try {
                    return await this.whatsappProvider.sendMessage({
                        to: recipient,
                        body: message,
                        mediaUrl,
                    });
                } catch (error) {
                    console.warn('WhatsApp media send failed. Falling back to text-only message.');
                    console.warn(error.message);
                }
            }

            return this.whatsappProvider.sendMessage({
                to: recipient,
                body: message,
            });
        }

        throw new Error(`Unsupported notification channel: ${effectiveChannel}`);
    }
}

module.exports = { NotificationService };

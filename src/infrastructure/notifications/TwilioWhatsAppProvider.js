const { WhatsAppProvider } = require('./WhatsAppProvider');

class TwilioWhatsAppProvider extends WhatsAppProvider {
    constructor({ accountSid, authToken, from, to }) {
        super();
        this.accountSid = accountSid;
        this.authToken = authToken;
        this.from = from;
        this.to = to;
        this.client = null;
    }

    getClient() {
        if (!this.client) {
            if (!this.accountSid || !this.authToken) {
                throw new Error('Twilio credentials are required to create a Twilio client.');
            }

            const Twilio = require('twilio');
            this.client = Twilio(this.accountSid, this.authToken);
        }

        return this.client;
    }

    async sendMessage({ to, body }) {
        if (!to) {
            throw new Error('WhatsApp destination number is required.');
        }

        if (!body) {
            throw new Error('WhatsApp message body is required.');
        }

        const client = this.getClient();
        const fromAddress = this.from ?? process.env.TWILIO_WHATSAPP_FROM;
        const toAddress = to ?? process.env.TWILIO_WHATSAPP_TO;

        if (!fromAddress || !toAddress) {
            throw new Error('TWILIO_WHATSAPP_FROM and TWILIO_WHATSAPP_TO must be configured.');
        }

        return client.messages.create({
            body,
            from: fromAddress,
            to: toAddress,
        });
    }
}

module.exports = { TwilioWhatsAppProvider };
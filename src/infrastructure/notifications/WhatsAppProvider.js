class WhatsAppProvider {
    async sendMessage({ to, body }) {
        throw new Error('sendMessage must be implemented by a subclass.');
    }
}

module.exports = { WhatsAppProvider };
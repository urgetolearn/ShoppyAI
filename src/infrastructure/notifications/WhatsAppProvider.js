class WhatsAppProvider {
    /**
     * @param {{ to: string, body: string, mediaUrl?: string }} params
     */
    async sendMessage({ to, body, mediaUrl }) {
        throw new Error('sendMessage must be implemented by a subclass.');
    }
}

module.exports = { WhatsAppProvider };
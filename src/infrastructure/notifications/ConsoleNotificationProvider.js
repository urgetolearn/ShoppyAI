class ConsoleNotificationProvider {
  async send(channel, user, message, mediaUrl) {
    if (channel !== 'console') {
      throw new Error(`ConsoleNotificationProvider cannot send ${channel}`);
    }

    console.log('\n🔔 Console notification');
    console.log(`To: ${user.name ?? user.id}`);
    console.log(`Message: ${message}`);
    if (mediaUrl) {
      console.log(`Media: ${mediaUrl}`);
    }
  }
}

module.exports = { ConsoleNotificationProvider };

class ConsoleNotificationProvider {
  async send(channel, user, message) {
    if (channel !== 'console') {
      throw new Error(`ConsoleNotificationProvider cannot send ${channel}`);
    }

    console.log('\n🔔 Console notification');
    console.log(`To: ${user.name ?? user.id}`);
    console.log(`Message: ${message}`);
  }
}

module.exports = { ConsoleNotificationProvider };

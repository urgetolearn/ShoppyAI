class InMemoryMemoryService {
  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.interests = new Map();
    this.reminders = new Map();
  }

  async saveUser(user) {
    this.users.set(user.id, user);
    return user;
  }

  async getUser(userId) {
    return this.users.get(userId) ?? null;
  }

  async saveProduct(product) {
    this.products.set(product.id, product);
    return product;
  }

  async getProduct(productId) {
    return this.products.get(productId) ?? null;
  }

  async saveInterest(interest) {
    this.interests.set(interest.id, interest);
    return interest;
  }

  async getInterests(userId) {
    const interests = Array.from(this.interests.values());

    if (!userId) {
      return interests;
    }

    return interests.filter((interest) => interest.userId === userId);
  }

  async saveReminder(reminder) {
    this.reminders.set(reminder.id, reminder);
    return reminder;
  }

  async getReminders() {
    return Array.from(this.reminders.values());
  }

  async getRemindersForInterest(interestId) {
    return Array.from(this.reminders.values()).filter(
      (reminder) => reminder.interestId === interestId,
    );
  }

  async markReminderSent(reminderId, sentAt) {
    const reminder = this.reminders.get(reminderId);

    if (!reminder) {
      return null;
    }

    const sentReminder = {
      ...reminder,
      status: 'sent',
      sentAt,
    };

    this.reminders.set(reminderId, sentReminder);
    return sentReminder;
  }
}

module.exports = { InMemoryMemoryService };

const { randomUUID } = require('node:crypto');

class ReminderRunner {
  constructor({
    memoryService,
    preferenceMemory,
    reminderPlanner,
    messageGenerator,
    notificationService,
    channel = 'console',
    publicBaseUrl,
  }) {
    this.memoryService = memoryService;
    this.preferenceMemory = preferenceMemory;
    this.reminderPlanner = reminderPlanner;
    this.messageGenerator = messageGenerator;
    this.notificationService = notificationService;
    this.channel = channel;
    this.publicBaseUrl = publicBaseUrl;
  }

  async run(evaluatedAt = new Date()) {
    const interests = await this.memoryService.getInterests();
    let sentCount = 0;

    for (const interest of interests) {
      if (interest.status !== 'active') {
        continue;
      }

      const user = await this.memoryService.getUser(interest.userId);
      const product = await this.memoryService.getProduct(interest.productId);

      if (!user || !product) {
        continue;
      }

      const previousReminders =
        await this.memoryService.getRemindersForInterest(interest.id);

      if (previousReminders.some((reminder) => reminder.status === 'sent')) {
        continue;
      }

      const plan = this.reminderPlanner.evaluateInterest({
        user,
        product,
        interest,
        previousReminders,
        evaluatedAt,
      });

      if (!plan.shouldNotify) {
        continue;
      }

      const preferences = await this.preferenceMemory.getPreferences(user.id);
      const message = await this.messageGenerator.generateReminderMessage({
        user,
        product,
        interest,
        preferences,
        channel: this.channel,
      });

      const reminder = await this.memoryService.saveReminder({
        id: randomUUID(),
        userId: user.id,
        productId: product.id,
        interestId: interest.id,
        message,
        scheduledFor: plan.scheduledFor ?? evaluatedAt,
        status: 'pending',
        channel: this.channel,
        mediaUrl: this.getProductMediaUrl(product),
        priority: plan.priority,
        createdAt: evaluatedAt,
      });

      console.log("📱 About to send notification...");
      console.log(
        "Notification service:",
        this.notificationService.constructor.name
      );
      console.log("Channel:", this.channel);
      console.log("User:", user);
      console.log("Message:", message);

      try {
        const result = await this.notificationService.send(
          this.channel,
          user,
          message,
          reminder.mediaUrl
        );

        console.log("✅ Notification sent!");
        console.log(result);

        await this.memoryService.markReminderSent(reminder.id, evaluatedAt);
        sentCount += 1;
      } catch (err) {
        console.error("❌ Notification error:", err);
      }
    }

    return { sentCount, evaluatedAt };
  }

  getProductMediaUrl(product) {
    if (!product?.imageUrl) {
      return undefined;
    }

    if (/^https?:\/\//i.test(product.imageUrl)) {
      return product.imageUrl;
    }

    if (!this.publicBaseUrl) {
      return undefined;
    }

    return new URL(product.imageUrl, this.publicBaseUrl).toString();
  }
}

module.exports = { ReminderRunner };

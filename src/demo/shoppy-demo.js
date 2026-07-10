const { BasicInterestTracker } = require('../application/BasicInterestTracker');
const { InterestScoringEngine } = require('../application/InterestScoringEngine');
const { ReminderRunner } = require('../application/ReminderRunner');
const { Scheduler } = require('../application/Scheduler');
const { SimpleMessageGenerator } = require('../application/SimpleMessageGenerator');
const { SimpleReminderPlanner } = require('../application/SimpleReminderPlanner');
const {
  InMemoryMemoryService,
} = require('../infrastructure/memory/InMemoryMemoryService');
const {
  UserPreferenceMemory,
} = require('../infrastructure/memory/UserPreferenceMemory');
const {
  ConsoleNotificationProvider,
} = require('../infrastructure/notifications/ConsoleNotificationProvider');

async function runDemo() {
  const memoryService = new InMemoryMemoryService();
  const preferenceMemory = new UserPreferenceMemory();
  const scoringEngine = new InterestScoringEngine();
  const interestTracker = new BasicInterestTracker(
    memoryService,
    scoringEngine,
  );

  const user = {
    id: 'user_001',
    name: 'Aarav',
    email: 'aarav@example.com',
    preferences: {
      reminderTone: 'friendly',
    },
    createdAt: new Date('2026-07-08T09:00:00.000Z'),
  };

  const shirt = {
    id: 'product_blue_oversized_shirt',
    title: 'Blue oversized shirt',
    price: 1499,
    currency: 'INR',
    url: 'https://example.com/products/blue-oversized-shirt',
    imageUrl: './assets/blue-oversized-shirt.jpg',
    metadata: {
      category: 'shirts',
      brand: 'ShoppyAI Demo',
      tags: ['blue', 'oversized', 'casual'],
    },
  };

  const sneakers = {
    id: 'product_black_sneakers',
    title: 'Black running sneakers',
    price: 2299,
    currency: 'INR',
    url: 'https://example.com/products/black-running-sneakers',
    imageUrl: './assets/black-running-sneakers.jpg',
    metadata: {
      category: 'sneakers',
      brand: 'ShoppyAI Demo',
      tags: ['black', 'running', 'comfortable'],
    },
  };

  await memoryService.saveUser(user);
  await memoryService.saveProduct(shirt);
  await memoryService.saveProduct(sneakers);

  const preferences = await preferenceMemory.savePreferences(user.id, {
    favouriteCategories: ['shirts', 'sneakers'],
    favouriteColors: ['blue', 'black'],
    preferredPriceRange: {
      min: 1000,
      max: 2500,
      currency: 'INR',
    },
  });

  const now = new Date();
  const moreThanThreeHoursAgo = new Date(now.getTime() - 3.5 * 60 * 60 * 1000);

  await interestTracker.recordProductView({
    userId: user.id,
    product: shirt,
    occurredAt: new Date(moreThanThreeHoursAgo.getTime() - 5 * 60 * 1000),
  });

  const shirtInterest = await interestTracker.recordProductView({
    userId: user.id,
    product: shirt,
    occurredAt: moreThanThreeHoursAgo,
  });

  const sneakerInterest = await interestTracker.recordCartAddition({
    userId: user.id,
    product: sneakers,
    occurredAt: moreThanThreeHoursAgo,
  });

  const reminderRunner = new ReminderRunner({
    memoryService,
    preferenceMemory,
    reminderPlanner: new SimpleReminderPlanner(),
    messageGenerator: new SimpleMessageGenerator(),
    notificationService: new ConsoleNotificationProvider(),
    channel: 'console',
  });

  const scheduler = new Scheduler({
    intervalMs: 30_000,
    task: async () => {
      const result = await reminderRunner.run(new Date());
      console.log(
        `\nScheduler tick complete: ${result.sentCount} reminder(s) sent.`,
      );
    },
  });

  console.log('ShoppyAI autonomous reminder demo');
  console.log('---------------------------------');
  console.log(`User: ${user.name}`);
  console.log(
    `Preferences: ${preferences.favouriteColors.join(', ')} ${preferences.favouriteCategories.join(', ')}`,
  );
  console.log('\nSeeded interests:');
  console.log(
    `- ${shirt.title}: score ${shirtInterest.score}, ${shirtInterest.interestType}`,
  );
  console.log(
    `- ${sneakers.title}: score ${sneakerInterest.score}, ${sneakerInterest.interestType}`,
  );
  console.log('\nStarting scheduler. It runs every 30 seconds.');
  console.log('First run happens immediately for this demo.');

  scheduler.start({ runImmediately: true });

  setTimeout(() => {
    scheduler.stop();
    console.log('\nDemo stopped after initial autonomous run.');
  }, 2_000);
}

runDemo().catch((error) => {
  console.error('Demo failed:', error);
  process.exitCode = 1;
});

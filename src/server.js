require('dotenv').config();
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { BasicInterestTracker } = require('./application/BasicInterestTracker');
const { InterestScoringEngine } = require('./application/InterestScoringEngine');
const { ReminderRunner } = require('./application/ReminderRunner');
const { Scheduler } = require('./application/Scheduler');
const { BehaviorAwareMessageGenerator } = require('./application/BehaviorAwareMessageGenerator');
const { SimpleReminderPlanner } = require('./application/SimpleReminderPlanner');
const {
  InMemoryMemoryService,
} = require('./infrastructure/memory/InMemoryMemoryService');
const {
  UserPreferenceMemory,
} = require('./infrastructure/memory/UserPreferenceMemory');
const {
  ConsoleNotificationProvider,
} = require('./infrastructure/notifications/ConsoleNotificationProvider');
const { NotificationService } = require('./infrastructure/notifications/NotificationService');
const { TwilioWhatsAppProvider } = require('./infrastructure/notifications/TwilioWhatsAppProvider');
const { UserProfileService } = require('./application/UserProfileService');
const { ProfilePhotoStorage } = require('./infrastructure/storage/ProfilePhotoStorage');
const { mockProducts } = require('./demo/mockProducts');

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ASSETS_DIR = path.join(__dirname, 'demo', 'assets');
const UPLOADS_DIR = path.join(__dirname, '..', 'demo', 'uploads');
const DEMO_TIME_OFFSET_MS = 3.25 * 60 * 60 * 1000;

const SUPPORTED_EVENTS = [
  'product_view',
  'repeated_view',
  'time_spent',
  'add_to_cart',
  'add_to_wishlist',
  'checkout_started',
  'purchase_completed',
];
function createAppState() {
  const memoryService = new InMemoryMemoryService();
  const preferenceMemory = new UserPreferenceMemory();
  const reminderPlanner = new SimpleReminderPlanner();
  const userProfileService = new UserProfileService({
    storage: new ProfilePhotoStorage({ uploadDir: UPLOADS_DIR }),
  });
  const user = {
    id: 'demo_user',
    name: 'Demo Shopper',
    email: 'demo@shoppy.ai',
    preferences: {
      reminderTone: 'friendly',
    },
    createdAt: new Date(),
  };

  const interestTracker = new BasicInterestTracker(
    memoryService,
    new InterestScoringEngine(),
  );

  const notificationChannel =
    process.env.NOTIFICATION_CHANNEL === 'whatsapp' ? 'whatsapp' : 'console';

  const notificationService = new NotificationService({
    channel: notificationChannel,
    consoleProvider: new ConsoleNotificationProvider(),
    whatsappProvider: new TwilioWhatsAppProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: process.env.TWILIO_WHATSAPP_TO,
    }),
  });

  const reminderRunner = new ReminderRunner({
    memoryService,
    preferenceMemory,
    reminderPlanner,
    messageGenerator: new BehaviorAwareMessageGenerator(),
    notificationService,
    channel: notificationChannel,
  });

  const scheduler = new Scheduler({
    intervalMs: 30_000,
    task: async () => {
      const result = await reminderRunner.run(new Date());
      if (result.sentCount > 0) {
        console.log(`Agent sent ${result.sentCount} reminder(s).`);
      }
    },
  });

  return {
    cartProductIds: new Set(),
    wishlistProductIds: new Set(),
    behaviorEvents: [],
    products: mockProducts,
    memoryService,
    preferenceMemory,
    reminderPlanner,
    userProfileService,
    interestTracker,
    notificationService,
    reminderRunner,
    scheduler,
    user,
  };
}

async function initializeState(state) {
  await state.memoryService.saveUser(state.user);
  await Promise.all(
    state.products.map((product) => state.memoryService.saveProduct(product)),
  );
  await state.preferenceMemory.savePreferences(state.user.id, {
    favouriteCategories: ['shirts', 'sneakers', 'hoodies'],
    favouriteColors: ['blue', 'black', 'green'],
    preferredPriceRange: {
      min: 1000,
      max: 3000,
      currency: 'INR',
    },
  });
}

function createServer(state = createAppState()) {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/') {
        return sendStaticFile(response, 'index.html');
      }

      if (request.method === 'GET' && request.url === '/api/products') {
        return sendJson(response, state.products);
      }

      if (request.method === 'GET' && request.url.startsWith('/api/products/')) {
        const productId = decodeURIComponent(request.url.split('/').at(-1));
        const product = getCatalogProduct(state, productId);
        return product
          ? sendJson(response, product)
          : sendJson(response, { error: 'Product not found' }, 404);
      }

      if (request.method === 'GET' && request.url === '/api/cart') {
        return sendJson(response, getProductsByIds(state, state.cartProductIds));
      }

      if (request.method === 'GET' && request.url === '/api/wishlist') {
        return sendJson(response, getProductsByIds(state, state.wishlistProductIds));
      }

      if (request.method === 'GET' && request.url === '/api/profile') {
        return sendJson(response, await state.userProfileService.getProfile(state.user));
      }

      if (request.method === 'POST' && request.url === '/api/profile/photo') {
        const result = await state.userProfileService.uploadPhotoFromRequest({
          user: state.user,
          request,
        });
        return sendJson(response, result, 201);
      }

      if (request.method === 'POST' && request.url === '/api/events') {
        const payload = await readJson(request);
        const eventType = String(payload.eventType ?? '');
        if (!SUPPORTED_EVENTS.includes(eventType)) {
          return sendJson(response, { error: `Unsupported event type: ${eventType}` }, 400);
        }

        const result = await processEvent(state, payload);
        return sendJson(response, result, 201);
      }

      if (request.method === 'POST' && request.url === '/api/store/events') {
        const payload = await readJson(request);
        const result = await processEvent(state, normalizeLegacyStoreEvent(state, payload));
        return sendJson(response, result, 201);
      }

      if (request.method === 'POST' && request.url === '/api/interests') {
        const payload = await readJson(request);
        const result = await createInterest(state, payload);
        const runnerResult = await state.reminderRunner.run(new Date());
        return sendJson(response, { ...result, runnerResult }, 201);
      }

      if (request.method === 'POST' && request.url === '/api/test-whatsapp') {
        const payload = await readJson(request);
        const message = String(payload.message ?? '').trim();

        if (!message) {
          return sendJson(response, { error: 'message is required' }, 400);
        }

        const result = await state.notificationService.send('whatsapp', state.user, message);
        return sendJson(response, { success: true, result }, 200);
      }

      if (request.method === 'GET' && request.url.startsWith('/assets/')) {
        return sendAssetFile(response, request.url.slice(1));
      }

      if (request.method === 'GET' && request.url.startsWith('/uploads/')) {
        return sendUploadFile(response, request.url.slice('/uploads/'.length));
      }

      if (request.method === 'GET') {
        return sendStaticFile(response, request.url.slice(1));
      }

      sendJson(response, { error: 'Not found' }, 404);
    } catch (error) {
      console.error(error);
      sendJson(response, { error: error.message }, 500);
    }
  });

  server.once('listening', () => {
    state.scheduler.start({ runImmediately: false });
  });

  server.once('close', () => {
    state.scheduler.stop();
  });

  return { server, state };
}

async function trackStoreEvent(state, payload) {
  return processEvent(state, normalizeLegacyStoreEvent(state, payload));
}

async function processEvent(state, payload) {
  const userId = String(payload.userId ?? state.user.id);
  const product = getCatalogProduct(state, payload.productId);

  if (!product) {
    throw new Error(`Unknown product: ${payload.productId}`);
  }

  const eventType = String(payload.eventType ?? '');
  const occurredAt = new Date(Date.now() - DEMO_TIME_OFFSET_MS);
  const metadata = payload.metadata ?? {};
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    productId: product.id,
    eventType,
    metadata,
    timeSpentSeconds: Number(metadata.timeSpentSeconds ?? 0),
    occurredAt: new Date(),
  };

  await ensureUser(state, userId);
  await state.memoryService.saveProduct(product);

  const eventHandlers = {
    product_view: () =>
      state.interestTracker.recordProductView({
        userId,
        product,
        occurredAt,
      }),
    repeated_view: () =>
      state.interestTracker.recordProductView({
        userId,
        product,
        occurredAt,
      }),
    add_to_cart: async () => {
      state.cartProductIds.add(product.id);
      return state.interestTracker.recordCartAddition({
        userId,
        product,
        occurredAt,
      });
    },
    remove_from_cart: async () => {
      state.cartProductIds.delete(product.id);
      return { removed: true };
    },
    add_to_wishlist: async () => {
      state.wishlistProductIds.add(product.id);
      return state.interestTracker.recordWishlist({
        userId,
        product,
        occurredAt,
      });
    },
    remove_from_wishlist: async () => {
      state.wishlistProductIds.delete(product.id);
      return { removed: true };
    },
    time_spent: async () => {
      const seconds = event.timeSpentSeconds;
      if (seconds >= 15) {
        return state.interestTracker.recordProductView({
          userId,
          product,
          occurredAt,
        });
      }

      return null;
    },
    checkout_started: async () => getExistingInterest(state, userId, product.id),
    purchase_completed: async () => getExistingInterest(state, userId, product.id),
  };

  const handler = eventHandlers[eventType];
  if (!handler) {
    throw new Error(`Unsupported event: ${eventType}`);
  }

  const handledInterest = await handler();
  const currentInterest =
    handledInterest?.id ? handledInterest : await getExistingInterest(state, userId, product.id);
  const plannerDecision = currentInterest
    ? await evaluateInterest(state, userId, product, currentInterest)
    : {
      shouldNotify: false,
      priority: 'none',
      reason: 'No interest exists for this event yet.',
    };

  state.behaviorEvents.unshift(event);
  state.behaviorEvents = state.behaviorEvents.slice(0, 50);
  await state.reminderRunner.run(new Date());

  return {
    success: true,
    currentInterest,
    currentScore: currentInterest?.score ?? 0,
    plannerDecision,
  };
}

function normalizeLegacyStoreEvent(state, payload) {
  return {
    userId: payload.userId ?? state.user.id,
    productId: payload.productId,
    eventType: payload.eventType,
    metadata: {
      ...(payload.metadata ?? {}),
      timeSpentSeconds: payload.timeSpentSeconds,
    },
  };
}

async function ensureUser(state, userId) {
  const user = await state.memoryService.getUser(userId);
  if (user) {
    return user;
  }

  return state.memoryService.saveUser({
    id: userId,
    name: userId,
    createdAt: new Date(),
  });
}

async function getExistingInterest(state, userId, productId) {
  const interests = await state.memoryService.getInterests(userId);
  return interests.find(
    (interest) =>
      interest.productId === productId && interest.status === 'active',
  ) ?? null;
}

async function evaluateInterest(state, userId, product, interest) {
  const user = await state.memoryService.getUser(userId);
  const previousReminders =
    await state.memoryService.getRemindersForInterest(interest.id);

  return state.reminderPlanner.evaluateInterest({
    user,
    product,
    interest,
    previousReminders,
    evaluatedAt: new Date(),
  });
}

async function createInterest(state, payload) {
  const product = normalizeProduct(payload);
  const occurredAt = new Date(Date.now() - DEMO_TIME_OFFSET_MS);

  await state.memoryService.saveProduct(product);

  const actionHandlers = {
    view: () =>
      state.interestTracker.recordProductView({
        userId: state.user.id,
        product,
        occurredAt,
      }),
    cart: () =>
      state.interestTracker.recordCartAddition({
        userId: state.user.id,
        product,
        occurredAt,
      }),
    wishlist: () =>
      state.interestTracker.recordWishlist({
        userId: state.user.id,
        product,
        occurredAt,
      }),
    price_drop: () =>
      state.interestTracker.recordPriceDrop({
        userId: state.user.id,
        product,
        occurredAt,
      }),
  };

  const handler = actionHandlers[payload.action];
  if (!handler) {
    throw new Error(`Unsupported action: ${payload.action}`);
  }

  const interest = await handler();
  return { product, interest };
}

async function buildUiState(state) {
  const interests = await state.memoryService.getInterests(state.user.id);
  const reminders = await state.memoryService.getReminders();

  const interestRows = await Promise.all(
    interests.map(async (interest) => {
      const product = await state.memoryService.getProduct(interest.productId);
      const previousReminders =
        await state.memoryService.getRemindersForInterest(interest.id);
      const plan = state.reminderPlanner.evaluateInterest({
        user: state.user,
        product,
        interest,
        previousReminders,
        evaluatedAt: new Date(),
      });
      const latestReminder = previousReminders.at(-1);

      return {
        id: interest.id,
        product: product?.title ?? interest.productId,
        score: interest.score,
        priority: plan.priority ?? latestReminder?.priority ?? 'none',
        reminderStatus: latestReminder?.status ?? 'not_generated',
        interestType: interest.interestType,
      };
    }),
  );

  return {
    scheduler: {
      intervalSeconds: 30,
    },
    behaviorEvents: state.behaviorEvents.map((event) => ({
      ...event,
      product: getCatalogProduct(state, event.productId)?.title ?? event.productId,
    })),
    cartCount: state.cartProductIds.size,
    wishlistCount: state.wishlistProductIds.size,
    interests: interestRows,
    reminders: reminders
      .slice()
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((reminder) => ({
        id: reminder.id,
        message: reminder.message,
        status: reminder.status,
        priority: reminder.priority,
        channel: reminder.channel,
        createdAt: reminder.createdAt,
        sentAt: reminder.sentAt,
      })),
  };
}

function getCatalogProduct(state, productId) {
  return state.products.find((product) => product.id === productId);
}

function getProductsByIds(state, productIds) {
  return Array.from(productIds)
    .map((productId) => getCatalogProduct(state, productId))
    .filter(Boolean);
}

function normalizeProduct(payload) {
  const title = String(payload.productName ?? '').trim();
  if (!title) {
    throw new Error('Product name is required');
  }

  const category = String(payload.category ?? '').trim();
  const color = String(payload.color ?? '').trim();
  const price = Number(payload.price ?? 0);

  return {
    id: slugify([title, category, color].filter(Boolean).join('-')),
    title,
    price,
    currency: 'INR',
    url: `https://example.com/products/${slugify(title)}`,
    metadata: {
      category,
      tags: [color, category].filter(Boolean),
    },
  };
}

async function sendStaticFile(response, filePath) {
  const safePath = filePath === '' ? 'index.html' : filePath;
  const absolutePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    return sendJson(response, { error: 'Invalid file path' }, 400);
  }

  try {
    const content = await fs.readFile(absolutePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': getContentType(absolutePath),
    });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sendJson(response, { error: 'Not found' }, 404);
    }

    throw error;
  }
}

async function sendAssetFile(response, filePath) {
  const safePath = filePath.slice('assets/'.length);
  const absolutePath = path.normalize(path.join(ASSETS_DIR, safePath));

  if (!absolutePath.startsWith(ASSETS_DIR)) {
    return sendJson(response, { error: 'Invalid file path' }, 400);
  }

  try {
    const content = await fs.readFile(absolutePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': getContentType(absolutePath),
    });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sendJson(response, { error: 'Asset not found' }, 404);
    }

    throw error;
  }
}

async function sendUploadFile(response, filePath) {
  const absolutePath = path.normalize(path.join(UPLOADS_DIR, filePath));

  if (!absolutePath.startsWith(UPLOADS_DIR)) {
    return sendJson(response, { error: 'Invalid file path' }, 400);
  }

  try {
    const content = await fs.readFile(absolutePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': getContentType(absolutePath),
    });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sendJson(response, { error: 'Upload not found' }, 404);
    }

    throw error;
  }
}

function getContentType(filePath) {
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }

  if (filePath.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }

  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (filePath.endsWith('.png')) {
    return 'image/png';
  }

  if (filePath.endsWith('.gif')) {
    return 'image/gif';
  }

  if (filePath.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'text/html; charset=utf-8';
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, payload, statusCode = 200) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

if (require.main === module) {
  const { server, state } = createServer();
  initializeState(state).then(() => {
    server.listen(PORT, () => {
      console.log(`ShoppyAI UI running at http://localhost:${PORT}`);
      console.log('Agent scheduler runs every 30 seconds.');
    });
  });
}

module.exports = { createServer, initializeState };

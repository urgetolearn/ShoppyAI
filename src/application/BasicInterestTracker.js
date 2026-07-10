const { randomUUID } = require('node:crypto');

class BasicInterestTracker {
  constructor(memoryService, scoringEngine) {
    this.memoryService = memoryService;
    this.scoringEngine = scoringEngine;
  }

  async recordProductView(input) {
    return this.recordInterest(input, 'viewed');
  }

  async recordCartAddition(input) {
    return this.recordInterest(input, 'added_to_cart');
  }

  async recordWishlist(input) {
    return this.recordInterest(input, 'wishlist');
  }

  async recordPriceDrop(input) {
    return this.recordInterest(input, 'price_drop');
  }

  async recordInterest(input, interestType) {
    const existingInterest = await this.findExistingInterest(
      input.userId,
      input.product.id,
    );

    if (existingInterest) {
      const interactionCount = existingInterest.interactionCount + 1;
      const signal =
        interestType === 'viewed' && interactionCount > 1
          ? 'repeated_view'
          : interestType;
      const updatedInterest = {
        ...existingInterest,
        interestType: signal,
        score: this.scoringEngine.calculateScore({
          signal,
          previousScore: existingInterest.score,
          interactionCount,
        }),
        interactionCount,
        lastInteractionAt: input.occurredAt,
        status: 'active',
        updatedAt: input.occurredAt,
      };

      return this.memoryService.saveInterest(updatedInterest);
    }

    const interest = {
      id: randomUUID(),
      userId: input.userId,
      productId: input.product.id,
      interestType,
      score: this.scoringEngine.calculateScore({
        signal: interestType,
        interactionCount: 1,
      }),
      interactionCount: 1,
      lastInteractionAt: input.occurredAt,
      status: 'active',
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
    };

    return this.memoryService.saveInterest(interest);
  }

  async findExistingInterest(userId, productId) {
    const interests = await this.memoryService.getInterests(userId);

    return interests.find(
      (interest) =>
        interest.productId === productId && interest.status === 'active',
    );
  }

}

module.exports = { BasicInterestTracker };

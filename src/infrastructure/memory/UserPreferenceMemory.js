class UserPreferenceMemory {
  constructor() {
    this.preferencesByUserId = new Map();
  }

  async savePreferences(userId, preferences) {
    const currentPreferences = this.preferencesByUserId.get(userId) ?? {};
    const nextPreferences = {
      ...currentPreferences,
      ...preferences,
    };

    this.preferencesByUserId.set(userId, nextPreferences);
    return nextPreferences;
  }

  async getPreferences(userId) {
    return this.preferencesByUserId.get(userId) ?? {
      favouriteCategories: [],
      favouriteColors: [],
      preferredPriceRange: undefined,
    };
  }
}

module.exports = { UserPreferenceMemory };

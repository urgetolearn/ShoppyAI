export type UserId = string;

export interface UserPreferences {
  preferredCategories?: string[];
  preferredBrands?: string[];
  favouriteCategories?: string[];
  favouriteColors?: string[];
  preferredPriceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  reminderTone?: 'friendly' | 'concise' | 'deal-focused';
  reminderChannels?: string[];
}

export interface User {
  id: UserId;
  name?: string;
  email?: string;
  preferences?: UserPreferences;
  createdAt: Date;
}

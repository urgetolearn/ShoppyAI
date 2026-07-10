import type { Product } from '../models/Product';
import type { UserId } from '../models/User';
import type { UserInterest } from '../models/UserInterest';

export interface TrackInterestInput {
  userId: UserId;
  product: Product;
  occurredAt: Date;
}

export interface InterestTracker {
  recordProductView(input: TrackInterestInput): Promise<UserInterest>;
  recordCartAddition(input: TrackInterestInput): Promise<UserInterest>;
  recordWishlist(input: TrackInterestInput): Promise<UserInterest>;
  recordPriceDrop(input: TrackInterestInput): Promise<UserInterest>;
}

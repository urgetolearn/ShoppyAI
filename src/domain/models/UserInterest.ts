import type { ProductId } from './Product';
import type { UserId } from './User';

export type UserInterestId = string;

export type InterestType =
  | 'viewed'
  | 'saved'
  | 'added_to_cart'
  | 'repeated_view'
  | 'wishlist'
  | 'price_drop';

export type UserInterestStatus =
  | 'active'
  | 'dismissed'
  | 'converted'
  | 'expired';

export interface UserInterest {
  id: UserInterestId;
  userId: UserId;
  productId: ProductId;
  interestType: InterestType;
  score: number;
  interactionCount: number;
  lastInteractionAt: Date;
  status: UserInterestStatus;
  createdAt: Date;
  updatedAt: Date;
}

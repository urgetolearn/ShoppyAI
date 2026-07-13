import type { ProductId } from './Product';
import type { UserInterestId } from './UserInterest';
import type { UserId } from './User';

export type ReminderId = string;

export type ReminderStatus =
  | 'pending'
  | 'sent'
  | 'dismissed'
  | 'clicked'
  | 'cancelled';

export type ReminderPriority =
  | 'high'
  | 'normal'
  | 'none';

export type ReminderChannel =
  | 'console'
  | 'in_app'
  | 'email'
  | 'push'
  | 'whatsapp';

export interface Reminder {
  id: ReminderId;
  userId: UserId;
  productId: ProductId;
  interestId: UserInterestId;
  message: string;
  scheduledFor: Date;
  status: ReminderStatus;
  priority?: ReminderPriority;
  mediaUrl?: string;
  channel?: ReminderChannel;
  createdAt: Date;
  sentAt?: Date;
}

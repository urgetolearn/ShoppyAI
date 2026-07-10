import type { Product, ProductId } from '../models/Product';
import type { Reminder, ReminderId } from '../models/Reminder';
import type { User, UserId } from '../models/User';
import type { UserInterest, UserInterestId } from '../models/UserInterest';

export interface MemoryService {
  saveUser(user: User): Promise<User>;
  getUser(userId: UserId): Promise<User | null>;

  saveProduct(product: Product): Promise<Product>;
  getProduct(productId: ProductId): Promise<Product | null>;

  saveInterest(interest: UserInterest): Promise<UserInterest>;
  getInterests(userId?: UserId): Promise<UserInterest[]>;

  saveReminder(reminder: Reminder): Promise<Reminder>;
  getReminders(): Promise<Reminder[]>;
  getRemindersForInterest(interestId: UserInterestId): Promise<Reminder[]>;
  markReminderSent(reminderId: ReminderId, sentAt: Date): Promise<Reminder | null>;
}

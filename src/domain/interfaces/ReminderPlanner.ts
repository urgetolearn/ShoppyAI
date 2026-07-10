import type { Product } from '../models/Product';
import type { Reminder } from '../models/Reminder';
import type { User } from '../models/User';
import type { UserInterest } from '../models/UserInterest';

export interface ReminderEvaluationContext {
  user: User;
  product: Product;
  interest: UserInterest;
  previousReminders: Reminder[];
  evaluatedAt: Date;
}

export interface ReminderPlan {
  shouldNotify: boolean;
  priority?: 'high' | 'normal' | 'none';
  scheduledFor?: Date;
  reason?: string;
}

export interface ReminderPlanner {
  evaluateInterest(context: ReminderEvaluationContext): Promise<ReminderPlan>;
}

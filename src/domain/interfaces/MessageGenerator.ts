import type { Product } from '../models/Product';
import type { ReminderChannel } from '../models/Reminder';
import type { User } from '../models/User';
import type { UserInterest } from '../models/UserInterest';

export interface GenerateReminderMessageInput {
  user: User;
  product: Product;
  interest: UserInterest;
  channel?: ReminderChannel;
  preferences?: User['preferences'];
}

export interface MessageGenerator {
  generateReminderMessage(input: GenerateReminderMessageInput): Promise<string>;
}

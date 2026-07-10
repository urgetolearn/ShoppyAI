import type { User } from '../models/User';

export type NotificationChannel =
  | 'console'
  | 'whatsapp'
  | 'email'
  | 'in_app';

export interface NotificationService {
  send(
    channel: NotificationChannel,
    user: User,
    message: string,
  ): Promise<void>;
}

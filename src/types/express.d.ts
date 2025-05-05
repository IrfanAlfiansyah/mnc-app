import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: user;
    }
  }
}

interface user {
  user_id: number;
  // other user properties...
}

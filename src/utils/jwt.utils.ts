import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = 3600;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

export const generateToken = (userId: number): string => {
  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN
  };
  return jwt.sign({ userId }, JWT_SECRET, options);
};

export const verifyToken = (token: string): { userId: number } => {
  return jwt.verify(token, JWT_SECRET) as { userId: number };
};
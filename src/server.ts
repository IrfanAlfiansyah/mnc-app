import app from './app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    prisma.$disconnect().then(() => {
      console.log('Prisma disconnected.');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    prisma.$disconnect().then(() => {
      console.log('Prisma disconnected.');
      process.exit(0);
    });
  });
});
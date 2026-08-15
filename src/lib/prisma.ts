import { PrismaClient } from '@prisma/client';
import { Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_EobqeiNB2L6S@ep-purple-math-ahlo7uon-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&schema=servisplus';
  const adapter = new PrismaNeon(
    { connectionString },
    { schema: 'servisplus' }
  );

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

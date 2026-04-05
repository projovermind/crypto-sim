import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __dbWarmed?: boolean
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Connection warmup for serverless cold start optimization
if (!globalForPrisma.__dbWarmed) {
  globalForPrisma.__dbWarmed = true
  prisma.$connect().catch(() => {})
}

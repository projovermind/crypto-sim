import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = process.argv[2] || 'admin'
  const password = process.argv[3] || 'admin1234'

  const existing = await prisma.user.findUnique({ where: { email: username } })
  if (existing) {
    // 기존 유저를 ADMIN으로 업그레이드
    await prisma.user.update({
      where: { email: username },
      data: { role: 'ADMIN', status: 'APPROVED' },
    })
    console.log(`"${username}" → ADMIN 승격 완료`)
  } else {
    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.create({
      data: {
        email: username,
        name: 'Admin',
        password: hashed,
        role: 'ADMIN',
        status: 'APPROVED',
      },
    })
    console.log(`ADMIN 계정 생성: ${username} / ${password}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

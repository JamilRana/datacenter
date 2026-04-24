
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  })
  
  console.log('Total Users:', users.length)
  users.forEach(u => {
    console.log(`- ${u.name} (${u.email}) [ID: ${u.id}] Roles: ${u.roles.map(r => r.role.name).join(', ')}`)
  })
}

main().catch(console.error)

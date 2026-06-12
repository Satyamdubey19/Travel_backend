import { prisma } from "@/lib/prisma"

export async function getHostByUserId(userId: string) {
  return prisma.host.findUnique({ where: { userId } })
}

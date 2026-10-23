import { Prisma } from '@/prisma/generated/client'
import { PrismaModels } from 'prisma-models'

export type PModels = PrismaModels<Prisma.ModelName, Prisma.TypeMap>

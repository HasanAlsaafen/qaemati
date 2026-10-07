import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Actor {
  id: string;
  label: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(
    actor: Actor,
    action: string,
    restaurantId: string | null = null,
    meta: Record<string, unknown> = {},
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorType: 'SUPER_ADMIN',
        actorId: actor.id,
        actorLabel: actor.label,
        action,
        restaurantId,
        meta: meta as Prisma.InputJsonValue,
      },
    });
  }

  list(options: { restaurantId?: string; take?: number } = {}) {
    return this.prisma.auditLog.findMany({
      where: options.restaurantId ? { restaurantId: options.restaurantId } : {},
      orderBy: { createdAt: 'desc' },
      take: options.take ?? 100,
    });
  }
}

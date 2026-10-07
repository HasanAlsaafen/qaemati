import { PrismaService } from '../prisma/prisma.service';
import { PosEvent, PosEventBus } from './pos-event-bus';

const event: PosEvent = { type: 'order.new', restaurantId: 'r1', id: 'o1' };

describe('PosEventBus without a listening connection', () => {
  it('delivers an event to this instance instead of losing it', async () => {
    const bus = new PosEventBus({} as PrismaService);
    const seen: PosEvent[] = [];
    bus.subscribe((e) => seen.push(e));
    await bus.publish(event);
    expect(seen).toEqual([event]);
  });

  it('stops delivering after unsubscribe, and one failing listener does not stop the others', async () => {
    const bus = new PosEventBus({} as PrismaService);
    const seen: string[] = [];
    bus.subscribe(() => {
      throw new Error('boom');
    });
    const off = bus.subscribe((e) => seen.push(e.id));
    await bus.publish(event);
    off();
    await bus.publish({ ...event, id: 'o2' });
    expect(seen).toEqual(['o1']);
  });
});

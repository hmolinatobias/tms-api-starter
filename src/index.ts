import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/api/health', async () => ({ ok: true }));

// List shipments (with stops)
app.get('/api/shipments', async () => {
  const shipments = await prisma.shipment.findMany({ include: { stops: true, customer: true } });
  return shipments;
});

// Create shipment with multi-stops
app.post('/api/shipments', async (req, reply) => {
  const Body = z.object({
    customerId: z.string(),
    reference: z.string().optional(),
    status: z.enum(['DRAFT','PLANNED','IN_TRANSIT','DELIVERED','CLOSED','CANCELLED']).optional(),
    stops: z.array(z.object({
      sequence: z.number().int(),
      type: z.enum(['PICKUP','DELIVERY']),
      locationId: z.string(),
      windowStart: z.string().datetime().optional(),
      windowEnd: z.string().datetime().optional(),
      notes: z.string().optional()
    }))
  });
  const data = Body.parse(req.body);

  const created = await prisma.shipment.create({
    data: {
      customerId: data.customerId,
      reference: data.reference,
      status: data.status ?? 'DRAFT',
      stops: { create: data.stops.map(s => ({
        sequence: s.sequence,
        type: s.type,
        locationId: s.locationId,
        windowStart: s.windowStart ? new Date(s.windowStart) : undefined,
        windowEnd: s.windowEnd ? new Date(s.windowEnd) : undefined,
        notes: s.notes
      })) }
    },
    include: { stops: true }
  });

  reply.code(201).send(created);
});

// Assign carrier & rate
app.post('/api/shipments/:id/assign-carrier', async (req, reply) => {
  const Params = z.object({ id: z.string() });
  const Body = z.object({
    carrierId: z.string(),
    baseRate: z.number().default(0),
    fuelPct: z.number().default(0),
    accessorials: z.array(z.object({ code: z.string(), qty: z.number().default(1), rate: z.number().default(0) })).default([]),
    currency: z.string().default('USD')
  });
  const { id } = Params.parse(req.params as any);
  const body = Body.parse(req.body);

  const upsert = await prisma.carrierAssignment.upsert({
    where: { shipmentId: id },
    create: { shipmentId: id, carrierId: body.carrierId, baseRate: body.baseRate, fuelPct: body.fuelPct, accessorials: body.accessorials as any, currency: body.currency },
    update: { carrierId: body.carrierId, baseRate: body.baseRate, fuelPct: body.fuelPct, accessorials: body.accessorials as any, currency: body.currency }
  });

  reply.code(200).send(upsert);
});

// Set customer rate (AR side estimate)
app.post('/api/shipments/:id/customer-rate', async (req, reply) => {
  const Params = z.object({ id: z.string() });
  const Body = z.object({
    baseRate: z.number().default(0),
    fuelPct: z.number().default(0),
    accessorials: z.array(z.object({ code: z.string(), qty: z.number().default(1), rate: z.number().default(0) })).default([]),
    currency: z.string().default('USD')
  });
  const { id } = Params.parse(req.params as any);
  const body = Body.parse(req.body);

  const upsert = await prisma.customerRate.upsert({
    where: { shipmentId: id },
    create: { shipmentId: id, baseRate: body.baseRate, fuelPct: body.fuelPct, accessorials: body.accessorials as any, currency: body.currency },
    update: { baseRate: body.baseRate, fuelPct: body.fuelPct, accessorials: body.accessorials as any, currency: body.currency }
  });

  reply.code(200).send(upsert);
});

// Add check call
app.post('/api/shipments/:id/check-calls', async (req, reply) => {
  const Params = z.object({ id: z.string() });
  const Body = z.object({
    code: z.string(),
    notes: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    ts: z.string().datetime().optional()
  });
  const { id } = Params.parse(req.params as any);
  const body = Body.parse(req.body);

  const created = await prisma.checkCall.create({
    data: {
      shipmentId: id,
      code: body.code,
      notes: body.notes,
      lat: body.lat,
      lng: body.lng,
      ts: body.ts ? new Date(body.ts) : undefined
    }
  });

  reply.code(201).send(created);
});

const port = Number(process.env.PORT || 4000);
app.listen({ host: '0.0.0.0', port }).catch(err => {
  app.log.error(err);
  process.exit(1);
});

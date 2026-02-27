import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PaymentService } from '../services/payment.service';

const EnterPaymentSchema = z.object({
  rent_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  payment_mode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']),
  transaction_ref: z.string().max(120).optional(),
  paid_on: z.string().date().optional(),
  notes: z.string().max(500).optional(),
});

export async function paymentRoutes(app: FastifyInstance, paymentService: PaymentService): Promise<void> {
  app.post('/payments', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = EnterPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid payment payload' });
    }

    const body = parsed.data;
    const adminId = Number((request.user as { admin_id: number }).admin_id);

    const result = await paymentService.enterPayment({
      rentId: body.rent_id,
      amount: body.amount,
      paymentMode: body.payment_mode,
      transactionRef: body.transaction_ref,
      paidOn: body.paid_on,
      notes: body.notes,
      adminId,
    });

    return reply.code(201).send({
      payment: result.payment,
      rent_ledger: result.rentLedger,
      invoice: result.invoice,
      whatsapp_links: result.whatsappLinks,
    });
  });
}

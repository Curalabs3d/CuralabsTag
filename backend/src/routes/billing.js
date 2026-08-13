import { Router } from 'express';
import { nanoid } from 'nanoid';
import { withTenantContext } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenantScope } from '../middleware/tenant.js';
import { createSubscriptionCheckout, fetchPreapproval, isMercadoPagoConfigured } from '../services/mercadopago.js';

const router = Router();
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://nfc.curalabs3d.com.br';
const asWebhook = (callback) => withTenantContext({ tenantId: null, role: 'PAYMENT_WEBHOOK' }, callback);

// POST /api/billing/checkout — tenant admin inicia (ou troca de) uma assinatura paga
router.post('/checkout', requireAuth, requireRole('TENANT_ADMIN'), resolveTenantScope, async (req, res, next) => {
  try {
    if (!isMercadoPagoConfigured()) {
      return res.status(503).json({ error: 'Pagamentos ainda não configurados. Contate a CuraLabs3D.' });
    }

    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: 'planId é obrigatório.' });

    const result = await withTenantContext(req.tenantContext, async (client) => {
      const { rows: planRows } = await client.query('SELECT * FROM plans WHERE id = $1 AND active = true', [planId]);
      const plan = planRows[0];
      if (!plan) return { error: 'Plano não encontrado ou inativo.' };

      const { rows: tenantRows } = await client.query('SELECT * FROM tenants WHERE id = $1', [req.tenantScope]);
      const tenant = tenantRows[0];

      const { rows: subRows } = await client.query('SELECT * FROM subscriptions WHERE tenant_id = $1', [req.tenantScope]);
      let subscription = subRows[0];

      if (!subscription) {
        const id = `sub-${nanoid(10).toLowerCase()}`;
        await client.query(
          `INSERT INTO subscriptions (id, tenant_id, plan_id, status) VALUES ($1,$2,$3,'PENDING')`,
          [id, req.tenantScope, planId]
        );
        subscription = { id };
      }

      return { plan, tenant, subscriptionId: subscription.id };
    });

    if (result.error) return res.status(400).json({ error: result.error });
    const { plan, tenant, subscriptionId } = result;

    const checkout = await createSubscriptionCheckout({
      reason: `NFC Hub Manager — Plano ${plan.name}`,
      payerEmail: tenant.contact_email,
      monthlyPrice: plan.monthly_price,
      backUrl: `${PUBLIC_BASE_URL}/dashboard`,
      externalReference: subscriptionId,
    });

    await withTenantContext(req.tenantContext, (client) =>
      client.query(
        `UPDATE subscriptions SET plan_id = $1, status = 'PENDING', mercadopago_subscription_id = $2, updated_at = now() WHERE id = $3`,
        [plan.id, checkout.id, subscriptionId]
      )
    );

    // A API de Assinaturas (Preapproval) do Mercado Pago não tem uma URL de
    // sandbox separada — diferente da API de pagamento único (Checkout Pro),
    // ela sempre retorna só init_point, mesmo com credencial de teste. O
    // "modo teste" aqui vem da combinação: credencial TEST- no backend +
    // cartão de teste oficial preenchido na hora de pagar (nunca um cartão
    // real, mesmo a tela parecendo produção).
    res.json({ checkoutUrl: checkout.init_point });
  } catch (err) {
    if (err.notConfigured) return res.status(503).json({ error: 'Pagamentos ainda não configurados.' });
    next(err);
  }
});

// POST /api/webhooks/mercadopago — notificações de pagamento/assinatura
router.post('/webhooks/mercadopago', async (req, res, next) => {
  try {
    const { type, data } = req.body;

    if (type === 'subscription_preapproval' && data?.id) {
      const preapproval = await fetchPreapproval(data.id);
      const newStatus = preapproval.status === 'authorized' ? 'ACTIVE'
        : preapproval.status === 'cancelled' ? 'CANCELED'
        : 'PENDING';

      await asWebhook((client) =>
        client.query(
          `UPDATE subscriptions SET status = $1, next_billing_date = $2, past_due_since = NULL, updated_at = now()
           WHERE mercadopago_subscription_id = $3`,
          [newStatus, preapproval.next_payment_date || null, data.id]
        )
      );
    }

    if (type === 'payment' && data?.id) {
      // Pagamentos individuais dentro de uma assinatura recorrente — usado
      // para popular o histórico de cobranças (extrato do tenant).
      const { fetchPayment } = await import('../services/mercadopago.js');
      const payment = await fetchPayment(data.id);
      const externalReference = payment.external_reference; // = subscriptionId

      if (externalReference) {
        await asWebhook(async (client) => {
          const id = `bh-${nanoid(10).toLowerCase()}`;
          await client.query(
            `INSERT INTO billing_history (id, subscription_id, amount, status, mercadopago_payment_id, paid_at)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              id, externalReference, payment.transaction_amount,
              payment.status === 'approved' ? 'PAID' : payment.status === 'rejected' ? 'FAILED' : 'PENDING',
              data.id, payment.status === 'approved' ? new Date().toISOString() : null,
            ]
          );

          if (payment.status === 'rejected') {
            await client.query(
              `UPDATE subscriptions SET status = 'PAST_DUE', past_due_since = COALESCE(past_due_since, now()), updated_at = now()
               WHERE id = $1`,
              [externalReference]
            );
          } else if (payment.status === 'approved') {
            await client.query(
              `UPDATE subscriptions SET status = 'ACTIVE', past_due_since = NULL, updated_at = now() WHERE id = $1`,
              [externalReference]
            );
          }
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    // Webhooks devem sempre responder 200 quando possível para o Mercado Pago
    // não ficar re-tentando indefinidamente por um erro nosso já logado.
    console.error('[webhook mercadopago] erro ao processar:', err);
    res.status(200).json({ received: true, error: 'processado com erro, ver logs' });
  }
});

export default router;

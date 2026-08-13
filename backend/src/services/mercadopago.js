// Integração com a API de Assinaturas (Preapproval) do Mercado Pago.
// Docs: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/overview
//
// Assim como o serviço de e-mail (Resend), funciona em modo "não configurado"
// se MERCADOPAGO_ACCESS_TOKEN não estiver definida — evita quebrar o resto
// do sistema em ambientes onde a conta do Mercado Pago ainda não foi criada.

const MP_API_BASE = 'https://api.mercadopago.com';

function isConfigured() {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

async function mpFetch(path, options = {}) {
  if (!isConfigured()) {
    throw Object.assign(new Error('Mercado Pago não configurado (MERCADOPAGO_ACCESS_TOKEN ausente).'), { notConfigured: true });
  }
  const res = await fetch(`${MP_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.message || 'Erro na API do Mercado Pago.'), { mpError: data, status: res.status });
  }
  return data;
}

// Cria uma assinatura (preapproval) no modelo "pendente" — o retorno inclui
// init_point, a URL de checkout hospedada para redirecionar o tenant admin
// completar o cadastro do cartão/PIX.
export async function createSubscriptionCheckout({ reason, payerEmail, monthlyPrice, backUrl, externalReference }) {
  return mpFetch('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason,
      external_reference: externalReference,
      payer_email: payerEmail,
      back_url: backUrl,
      status: 'pending',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: Number(monthlyPrice),
        currency_id: 'BRL',
      },
    }),
  });
}

export async function fetchPreapproval(id) {
  return mpFetch(`/preapproval/${id}`);
}

export async function fetchPayment(id) {
  return mpFetch(`/v1/payments/${id}`);
}

export { isConfigured as isMercadoPagoConfigured };

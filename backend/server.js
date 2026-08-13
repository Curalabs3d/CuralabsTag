import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './src/routes/auth.js';
import tenantRoutes from './src/routes/tenants.js';
import tagRoutes from './src/routes/tags.js';
import publicRoutes from './src/routes/public.js';
import brandingRoutes from './src/routes/branding.js';
import planRoutes from './src/routes/plans.js';
import subscriptionRoutes from './src/routes/subscriptions.js';
import billingRoutes from './src/routes/billing.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'nfc-hub-manager-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/billing', billingRoutes); // inclui /api/billing/webhooks/mercadopago

// Handler de erro genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`NFC Hub Manager API rodando em http://localhost:${PORT}`);
});

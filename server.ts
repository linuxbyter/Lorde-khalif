import express from 'express';
import cors from 'cors';
import { executeStrategy } from './lib/ots/engine';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.warn('[WARNING] WEBHOOK_SECRET is not defined! Your endpoint is exposed.');
}

// Health check endpoint for Render monitoring
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Secure endpoint to intercept Vercel dispatches
app.post('/api/trade', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    console.error('[Render Server] Unauthorized execution attempt blocked.');
    return res.status(401).json({ error: 'Unauthorized entry vector signature' });
  }

  const { context, signal } = req.body;

  if (!context || !signal) {
    return res.status(400).json({ error: 'Malformed payload data structures' });
  }

  console.log(`[Render Server] Handshake dispatch received for Account: ${context.accountId}`);
  
  // Trigger the long-lived live transaction logic safely 
  const result = await executeStrategy({ context, signal });

  if (!result.success) {
    return res.status(500).json(result);
  }

  return res.status(200).json(result);
});

app.listen(PORT, () => {
  console.log(`[Render Server] Production trading daemon listening on port ${PORT}`);
});

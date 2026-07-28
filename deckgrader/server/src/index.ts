import express from 'express';
import cors from 'cors';
import { gradeRouter } from './routes/grade.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', gradeRouter);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`DeckGrader server listening on http://localhost:${PORT}`);
});

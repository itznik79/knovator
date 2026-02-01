import express from 'express';
import dotenv from 'dotenv';
import { Logger } from '@nestjs/common';

dotenv.config();

const logger = new Logger('ExpressServer');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/imports', (_req, res) => {
  res.json({ message: 'import logs endpoint - to be implemented' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => logger.log(`Server running on port ${port}`));

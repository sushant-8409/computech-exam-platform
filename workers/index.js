import { createRequestHandler } from '@cloudflare/express';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import uploadRoutes from './routes/upload.js';
// … import all your routers from ./routes/*.js …

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/api/upload', uploadRoutes);
app.use('/api/auth',   (await import('./routes/auth.js')).default);
app.use('/api/admin',  (await import('./routes/admin.js')).default);
app.use('/api/student',(await import('./routes/student.js')).default);
app.get('/api/health', (req, res) => res.json({ success: true }));

// connect to MongoDB Atlas
mongoose.connect(Deno.env.get('MONGODB_URI'), {
  // options…
}).catch(console.error);

export default {
  fetch: createRequestHandler(app)
};

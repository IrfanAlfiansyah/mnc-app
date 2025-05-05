import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/auth.routes'
import cartRoutes from './routes/auth.routes'

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/product', productRoutes)
app.use('/api/cart', cartRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

export default app;
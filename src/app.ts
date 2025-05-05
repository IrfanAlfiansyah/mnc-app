import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/auth.routes'
import cartRoutes from './routes/auth.routes'
import orderRoutes from './routes/auth.routes'

dotenv.config();

const app = express();

// Essential middleware
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/product', productRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/order', orderRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

export default app;
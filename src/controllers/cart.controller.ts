import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PrismaError {
  code?: string;
  meta?: {
    target?: string[];
  };
  message?: string;
}

function isPrismaError(error: unknown): error is PrismaError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

interface user {
  user_id: number;
}

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_id, quantity, user_id } = req.body

    // Validasi input
    if (!user_id || !product_id || quantity === undefined) {
      res.status(400).json({ error: 'User ID, Product ID and quantity are required' });
      return;
    }

    if (quantity <= 0) {
      res.status(400).json({ error: 'Quantity must be greater than 0' });
      return;
    }

    // Cek apakah produk ada dan stok mencukupi
    const product = await prisma.product.findUnique({
      where: { product_id: Number(product_id) },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.stok < quantity) {
      res.status(400).json({ 
        error: 'Insufficient stock',
        available_stock: product.stok
      });
      return;
    }

    // Gunakan transaction untuk atomic operation
    const result = await prisma.$transaction(async (prisma) => {
      // Cek apakah produk sudah ada di cart
      const existingCartItem = await prisma.cart.findUnique({
        where: {
          user_id_product_id: {
            user_id: Number(user_id),
            product_id: Number(product_id),
          },
        },
      });

      if (existingCartItem) {
        // Update quantity jika produk sudah ada di cart
        return await prisma.cart.update({
          where: {
            cart_id: existingCartItem.cart_id,
          },
          data: {
            quantity: existingCartItem.quantity + quantity,
          },
          include: {
            product: true,
          },
        });
      } else {
        // Tambahkan ke cart jika produk belum ada
        return await prisma.cart.create({
          data: {
            user_id: Number(user_id),
            product_id: Number(product_id),
            quantity,
          },
          include: {
            product: true,
          },
        });
      }
    });

    res.status(200).json({
      message: 'Product added to cart successfully',
      cartItem: result,
    });

  } catch (error: unknown) {
    console.error('Add to cart error:', error);
    
    if (isPrismaError(error)) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Product already in cart' });
        return;
      }
      if (error.code === 'P2003') {
        res.status(400).json({ 
          error: 'Invalid product or user ID',
          details: error.meta
        });
        return;
      }
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};
export const getCartItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const user_id = (req as any).user?.user_id; // Asumsikan user ID didapat dari middleware auth

    const cartItems = await prisma.cart.findMany({
      where: {
        user_id: Number(user_id),
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json(cartItems);
  } catch (error: unknown) {
    console.error('Get cart items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { quantity } = req.body;
    const cart_id = Number(req.params.cartId);
    const user_id = (req as any).user?.user_id;

    if (quantity === undefined || quantity <= 0) {
      res.status(400).json({ error: 'Valid quantity is required' });
      return;
    }

    // Cek apakah item cart ada dan milik user yang sesuai
    const cartItem = await prisma.cart.findFirst({
      where: {
        cart_id,
        user_id: Number(user_id),
      },
      include: {
        product: true,
      },
    });

    if (!cartItem) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    // Cek stok produk
    if (cartItem.product.stok < quantity) {
      res.status(400).json({ 
        error: 'Insufficient stock',
        available_stock: cartItem.product.stok
      });
      return;
    }

    // Update quantity
    const updatedCartItem = await prisma.cart.update({
      where: {
        cart_id,
      },
      data: {
        quantity,
      },
      include: {
        product: true,
      },
    });

    res.status(200).json(updatedCartItem);
  } catch (error: unknown) {
    console.error('Update cart item error:', error);
    
    if (isPrismaError(error)) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Cart item not found' });
        return;
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const cart_id = Number(req.params.cartId);
    const user_id = (req as any).user?.user_id;

    // Cek apakah item cart ada dan milik user yang sesuai
    const cartItem = await prisma.cart.findFirst({
      where: {
        cart_id,
        user_id: Number(user_id),
      },
    });

    if (!cartItem) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    await prisma.cart.delete({
      where: {
        cart_id,
      },
    });

    res.status(204).send();
  } catch (error: unknown) {
    console.error('Remove from cart error:', error);
    
    if (isPrismaError(error)) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Cart item not found' });
        return;
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};
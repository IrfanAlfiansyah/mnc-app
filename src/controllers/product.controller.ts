import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Type untuk error Prisma
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

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_name, price, stok } = req.body;

    if (!product_name || price === undefined || stok === undefined) {
      res.status(400).json({ error: 'Product name, price, and stok are required' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        product_name,
        price: parseFloat(price),
        stok: parseInt(stok),
      },
    });

    res.status(201).json(product);
  } catch (error: unknown) {
    console.error('Create product error:', error);
    
    if (isPrismaError(error)) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Product name must be unique' });
        return;
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.status(200).json(products);
  } catch (error: unknown) {
    console.error('Get all products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseInt(req.params.id);
    const product = await prisma.product.findUnique({
      where: {
        product_id: productId,
      },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.status(200).json(product);
  } catch (error: unknown) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseInt(req.params.id);
    const { product_name, price, stok } = req.body;

    if (!product_name || price === undefined || stok === undefined) {
      res.status(400).json({ error: 'Product name, price, and stok are required' });
      return;
    }

    const updatedProduct = await prisma.product.update({
      where: {
        product_id: productId,
      },
      data: {
        product_name,
        price: parseFloat(price),
        stok: parseInt(stok),
      },
    });

    res.status(200).json(updatedProduct);
  } catch (error: unknown) {
    console.error('Update product error:', error);
    
    if (isPrismaError(error)) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Product name must be unique' });
        return;
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProductStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseInt(req.params.id);
    const { stok } = req.body;

    if (stok === undefined) {
      res.status(400).json({ error: 'Stok is required' });
      return;
    }

    const updatedProduct = await prisma.product.update({
      where: {
        product_id: productId,
      },
      data: {
        stok: parseInt(stok),
      },
    });

    res.status(200).json(updatedProduct);
  } catch (error: unknown) {
    console.error('Update product stock error:', error);
    
    if (isPrismaError(error)) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseInt(req.params.id);

    await prisma.product.delete({
      where: {
        product_id: productId,
      },
    });

    res.status(204).send();
  } catch (error: unknown) {
    console.error('Delete product error:', error);
    
    if (isPrismaError(error)) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};
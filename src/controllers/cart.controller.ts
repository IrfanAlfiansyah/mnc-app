import { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PrismaError {
  code?: string;
  meta?: {
    target?: string[];
  };
  message?: string;
}

function isPrismaError(error: unknown): error is PrismaError {
  return typeof error === "object" && error !== null && "code" in error;
}

interface user {
  user_id: number;
}

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_id, quantity, user_id } = req.body;

    // Validasi input
    if (!user_id || !product_id || quantity === undefined) {
      res
        .status(400)
        .json({ error: "User ID, Product ID and quantity are required" });
      return;
    }

    if (quantity <= 0) {
      res.status(400).json({ error: "Quantity must be greater than 0" });
      return;
    }

    // Cek apakah produk ada dan stok mencukupi
    const product = await prisma.product.findUnique({
      where: { product_id: Number(product_id) },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    if (product.stok < quantity) {
      res.status(400).json({
        error: "Insufficient stock",
        available_stock: product.stok,
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
      message: "Product added to cart successfully",
      cartItem: result,
    });
  } catch (error: unknown) {
    console.error("Add to cart error:", error);

    if (isPrismaError(error)) {
      if (error.code === "P2002") {
        res.status(400).json({ error: "Product already in cart" });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({
          error: "Invalid product or user ID",
          details: error.meta,
        });
        return;
      }
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
export const getCartItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user_id } = req.body;

    const cartItems = await prisma.cart.findMany({
      where: {
        user_id: Number(user_id),
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(cartItems);
  } catch (error: unknown) {
    console.error("Get cart items error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCartItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate input parameters
    const cartId = Number(req.params.cartId);
    if (isNaN(cartId)) {
      res.status(400).json({ error: "Invalid cart ID" });
      return;
    }

    const { quantity } = req.body;
    if (quantity === undefined || quantity === null) {
      res.status(400).json({ error: "Quantity is required" });
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({
        error: "Quantity must be a positive integer",
        min_quantity: 1,
      });
      return;
    }

    // Get authenticated user ID (from JWT or session)
    const userId = (req as any).user?.user_id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized - User not authenticated" });
      return;
    }

    // Check cart item existence and ownership
    const cartItem = await prisma.cart.findUnique({
      where: { cart_id: cartId },
      include: { product: true },
    });

    if (!cartItem) {
      res.status(404).json({ error: "Cart item not found" });
      return;
    }

    if (cartItem.user_id !== Number(userId)) {
      res
        .status(403)
        .json({ error: "Forbidden - You don't own this cart item" });
      return;
    }

    // Check product stock availability
    if (cartItem.product.stok < quantity) {
      res.status(400).json({
        error: "Insufficient stock",
        available_stock: cartItem.product.stok,
        max_allowed: cartItem.product.stok,
      });
      return;
    }

    // Update cart item
    const updatedCartItem = await prisma.cart.update({
      where: { cart_id: cartId },
      data: { quantity },
      include: {
        product: {
          select: {
            product_id: true,
            product_name: true,
            price: true,
            stok: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Cart item updated successfully",
      data: updatedCartItem,
      remaining_stock: updatedCartItem.product.stok - quantity,
    });
  } catch (error: unknown) {
    console.error("Update cart item error:", error);

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        res.status(404).json({ error: "Cart item not found" });
        return;
      }
    }

    // General error handling
    res.status(500).json({
      error: "Internal server error",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

export const removeFromCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate cartId parameter
    const cartId = Number(req.params.cartId);
    if (isNaN(cartId)) {
      res.status(400).json({ 
        success: false,
        error: "Invalid cart ID",
        message: "Please provide a valid numeric cart ID"
      });
      return;
    }

    // Validate user_id from request body
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ 
        success: false,
        error: "Invalid request body",
        message: "Request body must be a JSON object"
      });
      return;
    }

    const { user_id } = req.body;
    if (user_id === undefined || user_id === null) {
      res.status(400).json({ 
        success: false,
        error: "User ID is required",
        message: "Please provide a user_id in the request body"
      });
      return;
    }

    const userId = Number(user_id);
    if (isNaN(userId)) {
      res.status(400).json({ 
        success: false,
        error: "Invalid user ID",
        message: "user_id must be a valid number"
      });
      return;
    }

    // Verify the cart item exists and belongs to the user
    const cartItem = await prisma.cart.findUnique({
      where: {
        cart_id: cartId,
      },
    });

    if (!cartItem) {
      res.status(404).json({ 
        success: false,
        error: "Cart item not found",
        message: `No cart item found with ID ${cartId}`
      });
      return;
    }

    if (cartItem.user_id !== userId) {
      res.status(403).json({ 
        success: false,
        error: "Unauthorized",
        message: "You are not authorized to delete this cart item"
      });
      return;
    }

    // Delete the cart item
    await prisma.cart.delete({
      where: {
        cart_id: cartId,
      },
    });

    res.status(200).json({ 
      success: true,
      message: "Item successfully removed from cart",
      deletedItemId: cartId
    });
  } catch (error: unknown) {
    console.error("Remove from cart error:", error);

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        res.status(404).json({ 
          success: false,
          error: "Not Found",
          message: "The cart item could not be found",
          prismaError: error.meta
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: "Database Error",
        message: "An error occurred while accessing the database",
        prismaError: error.message
      });
      return;
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "An unknown error occurred",
      ...(error instanceof Error && process.env.NODE_ENV === 'development' 
        ? { stack: error.stack } 
        : {})
    });
  }
};

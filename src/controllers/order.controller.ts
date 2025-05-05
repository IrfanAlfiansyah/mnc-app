import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import midtransClient from "midtrans-client";

const prisma = new PrismaClient();

// Initialize Midtrans client
const snap = new midtransClient.Snap({
  isProduction: false, // Set to true for production
  serverKey: process.env.MIDTRANS_SERVER_KEY || '',
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

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

export const checkout = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      user_id,
      shipping_address,
      customer_name,
      customer_email,
      customer_phone,
    } = req.body;

    // Validate input
    if (!user_id) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    // Get cart items for the user
    const cartItems = await prisma.cart.findMany({
      where: {
        user_id: Number(user_id),
      },
      include: {
        product: true,
      },
    });

    if (cartItems.length === 0) {
      res.status(400).json({ error: "Cart is empty" });
      return;
    }

    // Validate stock and calculate total amount
    let totalAmount = 0;
    const itemDetails = [];

    for (const item of cartItems) {
      if (item.product.stok < item.quantity) {
        res.status(400).json({
          error: `Insufficient stock for product ${item.product.product_name}`,
          product_id: item.product.product_id,
          available_stock: item.product.stok,
          requested_quantity: item.quantity,
        });
        return;
      }
      totalAmount += item.product.price * item.quantity;
      itemDetails.push({
        id: item.product.product_id.toString(),
        price: item.product.price,
        quantity: item.quantity,
        name: item.product.product_name,
      });
    }

    // Create order in database
    const order = await prisma.$transaction(async (prisma) => {
      // Create the order
      const newOrder = await prisma.order.create({
        data: {
          user_id: Number(user_id),
          total_amount: totalAmount,
          status: "pending",
          shipping_address: shipping_address || "",
        },
      });

      // Create order items
      const orderItems = await Promise.all(
        cartItems.map((item) =>
          prisma.orderItem.create({
            data: {
              order_id: newOrder.order_id,
              product_id: item.product_id,
              quantity: item.quantity,
              price: item.product.price,
            },
          })
        )
      );

      // Update product stocks
      await Promise.all(
        cartItems.map((item) =>
          prisma.product.update({
            where: { product_id: item.product_id },
            data: { stok: item.product.stok - item.quantity },
          })
        )
      );

      // Clear the cart
      await prisma.cart.deleteMany({
        where: {
          user_id: Number(user_id),
        },
      });

      return {
        ...newOrder,
        items: orderItems,
      };
    });

    // Prepare Midtrans transaction parameters
    const transactionDetails = {
      order_id: `ORDER-${order.order_id}-${Date.now()}`,
      gross_amount: totalAmount,
    };

    const customerDetails = {
      first_name: customer_name || "Customer",
      email: customer_email || "customer@example.com",
      phone: customer_phone || "08123456789",
    };

    // Create Midtrans transaction
    const parameter = {
      transaction_details: transactionDetails,
      customer_details: customerDetails,
      item_details: itemDetails,
    };

    const midtransResponse = await snap.createTransaction(parameter);

    // Update order with Midtrans token
    await prisma.order.update({
      where: { order_id: order.order_id },
      data: {
        payment_token: midtransResponse.token,
        payment_redirect_url: midtransResponse.redirect_url,
      },
    });

    res.status(200).json({
      message: "Checkout successful",
      order_id: order.order_id,
      payment_token: midtransResponse.token,
      redirect_url: midtransResponse.redirect_url,
    });
  } catch (error: unknown) {
    console.error("Checkout error:", error);

    if (isPrismaError(error)) {
      if (error.code === "P2002") {
        res.status(400).json({ error: "Order creation conflict" });
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

export const handlePaymentNotification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const notificationJson = req.body;

    // Verify the notification with Midtrans
    const statusResponse = await snap.transaction.notification(
      notificationJson
    );

    const orderId = statusResponse.order_id.split("-")[1]; // Extract the order ID
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    // Check transaction status
    if (transactionStatus === "capture") {
      if (fraudStatus === "challenge") {
        // Update order to challenge status
        await prisma.order.update({
          where: { order_id: Number(orderId) },
          data: { status: "challenge" },
        });
      } else if (fraudStatus === "accept") {
        // Update order to success status
        await prisma.order.update({
          where: { order_id: Number(orderId) },
          data: { status: "success" },
        });
      }
    } else if (transactionStatus === "settlement") {
      // Update order to success status
      await prisma.order.update({
        where: { order_id: Number(orderId) },
        data: { status: "success" },
      });
    } else if (
      transactionStatus === "cancel" ||
      transactionStatus === "deny" ||
      transactionStatus === "expire"
    ) {
      // Update order to failed status and restore stock
      await prisma.$transaction(async (prisma) => {
        // Get order items
        const orderItems = await prisma.orderItem.findMany({
          where: { order_id: Number(orderId) },
        });

        // Restore product stocks
        await Promise.all(
          orderItems.map((item) =>
            prisma.product.update({
              where: { product_id: item.product_id },
              data: { stok: { increment: item.quantity } },
            })
          )
        );

        // Update order status
        await prisma.order.update({
          where: { order_id: Number(orderId) },
          data: { status: "failed" },
        });
      });
    } else if (transactionStatus === "pending") {
      // Update order to pending status
      await prisma.order.update({
        where: { order_id: Number(orderId) },
        data: { status: "pending" },
      });
    }

    res.status(200).send("OK");
  } catch (error: unknown) {
    console.error("Payment notification error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const checkPaymentStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { order_id } = req.params;

    // Get order from database
    const order = await prisma.order.findUnique({
      where: { order_id: Number(order_id) },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // If order is already marked as success in our database
    if (order.status === "success") {
      res.status(200).json({
        status: "success",
        order_id: order.order_id,
        message: "Payment already confirmed",
      });
      return;
    }

    // Check with Midtrans if needed
    if (order.payment_token) {
      const statusResponse = await snap.transaction.status(order.payment_token);

      // Update order status based on Midtrans response
      if (
        statusResponse.transaction_status === "settlement" ||
        (statusResponse.transaction_status === "capture" &&
          statusResponse.fraud_status === "accept")
      ) {
        await prisma.order.update({
          where: { order_id: order.order_id },
          data: { status: "success" },
        });

        res.status(200).json({
          status: "success",
          order_id: order.order_id,
          message: "Payment confirmed",
        });
        return;
      }
    }

    res.status(200).json({
      status: order.status,
      order_id: order.order_id,
      message: `Payment status is ${order.status}`,
    });
  } catch (error: unknown) {
    console.error("Check payment status error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

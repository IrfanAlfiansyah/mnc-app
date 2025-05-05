import { Router } from 'express';
import { signUp, signIn } from '../controllers/auth.controller';
import { createProduct, deleteProduct, getAllProducts, getProductById, updateProduct, updateProductStock } from '../controllers/product.controller';
import { addToCart, getCartItems, removeFromCart, updateCartItem } from '../controllers/cart.controller';
import { checkout, checkPaymentStatus, handlePaymentNotification } from '../controllers/order.controller';

const router = Router();

// Correct route definitions
router.post('/signup', signUp);
router.post('/login', signIn);
router.post('/product', createProduct)
router.get('/product', getAllProducts)
router.get('/:productId', getProductById)
router.put('/productId', updateProduct)
router.put('/productId', updateProductStock)
router.delete('/productId', deleteProduct)
router.post('/cart', addToCart)
router.post('/cart-items', getCartItems)
router.put('/cartId', updateCartItem)
router.delete('/:cartId', removeFromCart)
router.post('/checkout', checkout);
router.post('/payment-notification', handlePaymentNotification);
router.get('/check-payment/:order_id', checkPaymentStatus);

export default router;
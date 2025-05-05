import { Router } from 'express';
import { signUp, signIn } from '../controllers/auth.controller';
import { createProduct, deleteProduct, getAllProducts, getProductById, updateProduct, updateProductStock } from '../controllers/product.controller';
import { addToCart, getCartItems, removeFromCart, updateCartItem } from '../controllers/cart.controller';

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
router.get('/cart/:userId', getCartItems)
router.put('/cartId', updateCartItem)
router.delete('/:cartId', removeFromCart)

export default router;
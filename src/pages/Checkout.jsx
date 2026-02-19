import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { createOrder } from '@/services/orders';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function Checkout() {
    const { cartItems, cartTotal, clearCart } = useCart();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: currentUser?.displayName || '',
        email: currentUser?.email || '',
        address: '',
        city: '',
        state: '',
        zip: '',
        phone: ''
    });

    if (cartItems.length === 0) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
                <Button onClick={() => navigate('/')}>Continue Shopping</Button>
            </div>
        );
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) {
            toast.error("Please login to checkout");
            return;
        }

        setLoading(true);

        try {
            // 1. Create Order (and Items inside service ideally, but we might need to handle items explicitly if service doesn't)
            // We will update the service to handle items.
            const orderId = await createOrder({
                buyerId: currentUser.id,
                items: cartItems, // Pass items to service
                total_amount: cartTotal,
                currency: 'NGN',
                shipping_address: {
                    fullName: formData.fullName,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    phone: formData.phone
                },
                payment_status: 'pending',
                payment_method: 'bank_transfer' // Default for now
            });

            // 2. Clear Cart
            await clearCart();

            toast.success("Order placed successfully!");
            navigate(`/orders/${orderId}`); // Or success page
        } catch (error) {
            console.error(error);
            toast.error("Failed to place order. " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Shipping Form */}
                <div>
                    <h2 className="text-2xl font-bold mb-6">Shipping Information</h2>
                    <form onSubmit={handleSubmit} id="checkout-form" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Full Name</label>
                                <input
                                    required
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Phone</label>
                                <input
                                    required
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <input
                                required
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Street Address</label>
                            <input
                                required
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">City</label>
                                <input
                                    required
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">State</label>
                                <input
                                    required
                                    name="state"
                                    value={formData.state}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Zip</label>
                                <input
                                    name="zip"
                                    value={formData.zip}
                                    onChange={handleChange}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 p-6 rounded-2xl h-fit">
                    <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
                    <div className="space-y-4 mb-6">
                        {cartItems.map(item => (
                            <div key={item.productId} className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div className="w-16 h-16 bg-white rounded-md border overflow-hidden flex-shrink-0">
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                    </div>
                                </div>
                                <p className="font-medium text-sm">{formatCurrency(item.price * item.quantity)}</p>
                            </div>
                        ))}
                    </div>

                    <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Shipping</span>
                            <span>Calculated next</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                            <span>Total</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                    </div>

                    <Button
                        className="w-full mt-6"
                        size="lg"
                        type="submit"
                        form="checkout-form"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Place Order'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

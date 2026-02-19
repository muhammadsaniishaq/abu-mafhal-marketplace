import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, ShoppingBag, Plus, Minus, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function CartDrawer({ isOpen, onClose }) {
    const { cartItems, updateQuantity, removeFromCart, cartTotal, loading } = useCart();
    const navigate = useNavigate();
    const [isUpdating, setIsUpdating] = useState(null);

    const handleQuantityChange = async (itemId, newQty) => {
        setIsUpdating(itemId);
        await updateQuantity(itemId, newQty);
        setIsUpdating(null);
    };

    const handleCheckout = () => {
        onClose();
        navigate('/checkout');
    };

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-500"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-500"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                            <Transition.Child
                                as={Fragment}
                                enter="transform transition ease-in-out duration-500 sm:duration-700"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-500 sm:duration-700"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                                    <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                                        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                                            <div className="flex items-start justify-between">
                                                <Dialog.Title className="text-lg font-medium text-gray-900">
                                                    Shopping Cart
                                                </Dialog.Title>
                                                <div className="ml-3 flex h-7 items-center">
                                                    <button
                                                        type="button"
                                                        className="relative -m-2 p-2 text-gray-400 hover:text-gray-500"
                                                        onClick={onClose}
                                                    >
                                                        <span className="absolute -inset-0.5" />
                                                        <span className="sr-only">Close panel</span>
                                                        <X className="h-6 w-6" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-8">
                                                <div className="flow-root">
                                                    {cartItems.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                                            <ShoppingBag className="h-12 w-12 text-gray-300 mb-4" />
                                                            <p className="text-gray-500">Your cart is empty.</p>
                                                            <Button variant="link" onClick={onClose} className="mt-2">
                                                                Continue Shopping
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <ul role="list" className="-my-6 divide-y divide-gray-200">
                                                            {cartItems.map((product) => (
                                                                <li key={product.id || product.productId} className="flex py-6">
                                                                    <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center">
                                                                        {product.image ? (
                                                                            <img
                                                                                src={product.image}
                                                                                alt={product.name}
                                                                                className="h-full w-full object-cover object-center"
                                                                            />
                                                                        ) : (
                                                                            <ShoppingBag className="h-8 w-8 text-gray-300" />
                                                                        )}
                                                                    </div>

                                                                    <div className="ml-4 flex flex-1 flex-col">
                                                                        <div>
                                                                            <div className="flex justify-between text-base font-medium text-gray-900">
                                                                                <h3 className="line-clamp-2">
                                                                                    <a href={`/product/${product.slug || '#'}`}>{product.name}</a>
                                                                                </h3>
                                                                                <p className="ml-4 tabular-nums">{formatCurrency(product.price * product.quantity)}</p>
                                                                            </div>
                                                                            <p className="mt-1 text-sm text-gray-500">{product.vendorName || "Vendor"}</p>
                                                                        </div>
                                                                        <div className="flex flex-1 items-end justify-between text-sm">
                                                                            <div className="flex items-center border rounded-md">
                                                                                <button
                                                                                    className="p-1 hover:bg-gray-100 disabled:opacity-50"
                                                                                    onClick={() => handleQuantityChange(product.productId, product.quantity - 1)}
                                                                                    disabled={isUpdating === product.productId}
                                                                                >
                                                                                    <Minus className="h-3 w-3" />
                                                                                </button>
                                                                                <span className="px-2 font-medium w-8 text-center">{product.quantity}</span>
                                                                                <button
                                                                                    className="p-1 hover:bg-gray-100 disabled:opacity-50"
                                                                                    onClick={() => handleQuantityChange(product.productId, product.quantity + 1)}
                                                                                    disabled={isUpdating === product.productId || product.quantity >= product.stock}
                                                                                >
                                                                                    <Plus className="h-3 w-3" />
                                                                                </button>
                                                                            </div>

                                                                            <div className="flex">
                                                                                <button
                                                                                    type="button"
                                                                                    className="font-medium text-red-600 hover:text-red-500 flex items-center gap-1"
                                                                                    onClick={() => removeFromCart(product.productId)}
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                    <span className="sr-only">Remove</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-200 px-4 py-6 sm:px-6">
                                            <div className="flex justify-between text-base font-medium text-gray-900">
                                                <p>Subtotal</p>
                                                <p>{formatCurrency(cartTotal)}</p>
                                            </div>
                                            <p className="mt-0.5 text-sm text-gray-500">Shipping and taxes calculated at checkout.</p>
                                            <div className="mt-6">
                                                <Button
                                                    className="w-full flex items-center justify-center rounded-md px-6 py-3 text-base font-medium shadow-sm"
                                                    onClick={handleCheckout}
                                                    disabled={cartItems.length === 0 || loading}
                                                >
                                                    Checkout
                                                </Button>
                                            </div>
                                            <div className="mt-6 flex justify-center text-center text-sm text-gray-500">
                                                <p>
                                                    or{' '}
                                                    <button
                                                        type="button"
                                                        className="font-medium text-primary hover:text-primary/80"
                                                        onClick={onClose}
                                                    >
                                                        Continue Shopping
                                                        <span aria-hidden="true"> &rarr;</span>
                                                    </button>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}

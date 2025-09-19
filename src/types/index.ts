import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/types';
import { ShoppingCart } from 'lucide-react';

const ProductRecommendationCard = ({ product }: { product: Product }) => {
  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-105 hover:shadow-lg">
      <Link href={`/products/${product.id}`} passHref>
        <div className="relative w-full h-48">
            <Image
                src={product.imageUrl || 'https://placehold.co/400x400/E2E8F0/4A5568?text=No+Image'}
                alt={product.name}
                layout="fill"
                objectFit="cover"
            />
        </div>
        <div className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white truncate">{product.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{product.category}</p>
            <div className="flex justify-between items-center mt-3">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">${product.price.toFixed(2)}</p>
                <button className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60">
                    <ShoppingCart size={18} />
                </button>
            </div>
        </div>
      </Link>
    </div>
  );
};

export default ProductRecommendationCard;

// src/services/aiProductService.js

// Validates input to ensure decent quality generation
const validateInput = (data) => {
    if (!data.name) throw new Error("Product Name is required for AI generation");
    if (!data.category) throw new Error("Category is required for AI generation");
};

export const aiProductService = {
    /**
     * Generate product description using smart templates (Simulating AI)
     */
    generateDescription: async (productData) => {
        validateInput(productData);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        const { name, category, price, brand, features } = productData;
        const categoryLower = category?.toLowerCase() || 'general';

        let intro = `Introducing the **${name}**, the ultimate addition to your ${categoryLower} collection. Designed with precision and style, this product stands out with its exceptional quality and performance.`;

        if (brand) {
            intro = `Experience the excellence of **${brand}** with the new **${name}**. Perfect for ${categoryLower} enthusiasts who demand the best.`;
        }

        const valueProp = `At a competitive price of **₦${price}**, it offers unbeatable value. Whether you're upgrading or buying your first, the ${name} is the perfect choice.`;

        const closing = `Don't miss out on this exclusive offer. Order now and enjoy fast shipping and premium customer support.`;

        return `${intro}\n\n${valueProp}\n\n${closing}`;
    },

    /**
     * Generate SEO Data
     */
    generateSEO: async (productData) => {
        validateInput(productData);
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { name, category, brand } = productData;

        return {
            title: `Buy ${name} Online | Best ${category} in Nigeria - ${brand || 'Abu Mafhal'}`,
            description: `Shop for ${name} at the best price. Discover high-quality ${category} from ${brand || 'top brands'}. Fast delivery nationwide.`,
            keywords: `${name}, ${category}, buy ${name}, ${brand || ''} ${category}, affordable ${category}, best price ${name}`
        };
    }
};

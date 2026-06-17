import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ComparisonContext = createContext();

const COMPARISON_STORAGE_KEY = '@abumafhal_comparison_v1';

export const ComparisonProvider = ({ children }) => {
    const [comparisonItems, setComparisonItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadComparison = async () => {
            try {
                const saved = await AsyncStorage.getItem(COMPARISON_STORAGE_KEY);
                if (saved) {
                    setComparisonItems(JSON.parse(saved));
                }
            } catch (e) {
                console.error('Error loading comparison items:', e);
            } finally {
                setLoading(false);
            }
        };
        loadComparison();
    }, []);

    const saveComparison = async (items) => {
        try {
            await AsyncStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            console.error('Error saving comparison items:', e);
        }
    };

    const addToComparison = (product) => {
        if (comparisonItems.length >= 4) {
            Alert.alert('Limit Reached', 'You can only compare up to 4 products at a time.');
            return;
        }

        if (comparisonItems.find(item => item.id === product.id)) {
            Alert.alert('Notice', 'Product already in comparison list.');
            return;
        }

        const updated = [...comparisonItems, product];
        setComparisonItems(updated);
        saveComparison(updated);
        Alert.alert('Success', `${product.name} added to comparison list.`);
    };

    const removeFromComparison = (productId) => {
        const updated = comparisonItems.filter(item => item.id !== productId);
        setComparisonItems(updated);
        saveComparison(updated);
    };

    const clearComparison = () => {
        setComparisonItems([]);
        saveComparison([]);
    };

    const isInComparison = (productId) => {
        return comparisonItems.some(item => item.id === productId);
    };

    return (
        <ComparisonContext.Provider
            value={{
                comparisonItems,
                addToComparison,
                removeFromComparison,
                clearComparison,
                isInComparison,
                comparisonCount: comparisonItems.length,
                loading
            }}
        >
            {children}
        </ComparisonContext.Provider>
    );
};

export const useComparison = () => {
    const context = useContext(ComparisonContext);
    if (!context) {
        throw new Error('useComparison must be used within ComparisonProvider');
    }
    return context;
};

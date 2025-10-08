import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, query, onSnapshot, getDoc } from 'firebase/firestore';

// --- Global Variables (Provided by Canvas Environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Sanitize the appId to ensure it does not contain invalid path characters (like '/')
const sanitizedAppId = appId.replace(/[#$.\[\]/]/g, '_'); 

// Mock product data 
const MOCK_PRODUCTS = [
    { id: 'prod1', name: 'Ultra HD 4K Monitor', category: 'Electronics', price: 399.99, imageUrl: 'https://placehold.co/150x150/50b4e5/FFFFFF?text=Monitor' },
    { id: 'prod2', name: 'Premium Leather Wallet', category: 'Accessories', price: 49.99, imageUrl: 'https://placehold.co/150x150/e550b4/FFFFFF?text=Wallet' },
    { id: 'prod3', name: 'Noise-Cancelling Headphones', category: 'Electronics', price: 199.99, imageUrl: 'https://placehold.co/150x150/7850e5/FFFFFF?text=Headphones' },
    { id: 'prod4', name: 'Ceramic Coffee Mug Set', category: 'Home Goods', price: 29.99, imageUrl: 'https://placehold.co/150x150/b4e550/FFFFFF?text=Mugs' },
    { id: 'prod5', name: 'Portable Bluetooth Speaker', category: 'Electronics', price: 79.99, imageUrl: 'https://placehold.co/150x150/50e5b4/FFFFFF?text=Speaker' },
    { id: 'prod6', name: 'Stainless Steel Water Bottle', category: 'Accessories', price: 19.99, imageUrl: 'https://placehold.co/150x150/e5b450/FFFFFF?text=Bottle' },
];

// --- Recommendation Logic (Client-Side Simulation) ---

/**
 * Simulates a recommendation engine using simple content-based filtering.
 */
const generateRecommendations = (currentProductId, purchaseHistory) => {
    if (MOCK_PRODUCTS.length === 0) return [];
    
    const currentProduct = MOCK_PRODUCTS.find(p => p.id === currentProductId);
    if (!currentProduct) return [];
    
    const { category: currentCategory } = currentProduct;

    // 1. Identify the user's favorite category based on purchases
    const categoryCounts = purchaseHistory.reduce((acc, item) => {
        const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
        if (product) {
            acc[product.category] = (acc[product.category] || 0) + item.purchaseCount;
        }
        return acc;
    }, {});

    const favoriteCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];

    // 2. Prioritize recommendations from the user's favorite category, 
    //    excluding the product currently being viewed and already purchased items.
    const purchasedIds = new Set(purchaseHistory.map(item => item.productId));

    let recommended = MOCK_PRODUCTS
        .filter(p => p.id !== currentProductId && !purchasedIds.has(p.id)) // Exclude current and purchased
        .sort((a, b) => {
            // Prioritize favorite category matches (Score 2), then current category matches (Score 1)
            const aScore = a.category === favoriteCategory ? 2 : 
                           a.category === currentCategory ? 1 : 0;
            const bScore = b.category === favoriteCategory ? 2 : 
                           b.category === currentCategory ? 1 : 0;
            return bScore - aScore;
        })
        .slice(0, 3);

    // If we don't have 3 recommendations, fill the rest with random popular items
    while (recommended.length < 3 && recommended.length < MOCK_PRODUCTS.length) {
        const randomProduct = MOCK_PRODUCTS.find(p => 
            !recommended.some(r => r.id === p.id) && p.id !== currentProductId
        );
        if (randomProduct) {
            recommended.push(randomProduct);
        } else {
            break; 
        }
    }
    
    return recommended;
};


// --- React Application Component ---

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Hardcode the product being viewed for demonstration
    const currentProductId = 'prod3'; 
    const currentProduct = MOCK_PRODUCTS.find(p => p.id === currentProductId);
    
    // Define user document reference path
    const userDocRef = db && userId 
        ? doc(db, 'artifacts', sanitizedAppId, 'users', userId, 'private_data', 'profile') 
        : null;

    // Initialize Firebase and Auth
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authentication = getAuth(app);

            setDb(firestore);
            setAuth(authentication);
            
            // Listen for auth state changes
            const unsubscribe = onAuthStateChanged(authentication, async (user) => {
                let currentUserId;
                if (user) {
                    currentUserId = user.uid;
                } else if (initialAuthToken) {
                    // Sign in with custom token if available
                    const userCredential = await signInWithCustomToken(authentication, initialAuthToken);
                    currentUserId = userCredential.user.uid;
                } else {
                    // Sign in anonymously if no token
                    const userCredential = await signInAnonymously(authentication);
                    currentUserId = userCredential.user.uid;
                }
                setUserId(currentUserId);
                setIsAuthReady(true);
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            setLoading(false);
        }
    }, []);

    // Fetch and initialize user data (Purchase History)
    useEffect(() => {
        if (!isAuthReady || !userDocRef) return;

        // Initializer function (run once to ensure the mock data exists)
        const initializeUserData = async () => {
            try {
                const docSnap = await getDoc(userDocRef);
                if (!docSnap.exists() || !docSnap.data().purchaseItems) { 
                    console.log("Initializing mock purchase history for new user.");
                    await setDoc(userDocRef, {
                        purchaseItems: [
                            { productId: 'prod1', purchaseCount: 2, date: new Date().toISOString() }, 
                            { productId: 'prod5', purchaseCount: 1, date: new Date().toISOString() }, 
                        ]
                    }, { merge: true }); // Use merge: true to avoid overwriting other potential fields
                }
            } catch (error) {
                 console.error("Error initializing user data:", error);
            }
        };
        
        // Setup Real-time Listener (onSnapshot)
        const setupListener = () => onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPurchaseHistory(data.purchaseItems || []); 
            } else {
                setPurchaseHistory([]);
            }
        }, (error) => {
            console.error("Error listening to purchase history:", error);
        });

        // Run initialization, then start the listener
        initializeUserData().then(() => {
            const unsubscribe = setupListener();
            return unsubscribe; // Return cleanup function
        });
        
    }, [isAuthReady, userDocRef]);
    
    /**
     * Updates the purchase history in Firestore to simulate a purchase.
     * @param {string} productId - The ID of the product purchased.
     */
    const simulatePurchase = useCallback(async (productId) => {
        if (!userDocRef || !db) {
            console.error("Database or user reference is not ready.");
            return;
        }

        try {
            let newHistory = [...purchaseHistory];
            const existingItemIndex = newHistory.findIndex(item => item.productId === productId);

            if (existingItemIndex > -1) {
                // Item exists, increment count
                newHistory[existingItemIndex] = {
                    ...newHistory[existingItemIndex],
                    purchaseCount: newHistory[existingItemIndex].purchaseCount + 1,
                    date: new Date().toISOString() // Update timestamp
                };
            } else {
                // New item, add to history
                newHistory.push({
                    productId: productId,
                    purchaseCount: 1,
                    date: new Date().toISOString()
                });
            }

            // Write the updated history back to Firestore
            await setDoc(userDocRef, { purchaseItems: newHistory }, { merge: true });
            console.log(`Purchase simulated for product: ${productId}. History updated.`);

        } catch (error) {
            console.error("Error simulating purchase:", error);
        }
    }, [purchaseHistory, userDocRef, db]);

    // Generate Recommendations once purchase history is available
    const recommendations = generateRecommendations(currentProductId, purchaseHistory);

    // --- UI RENDERING ---

    const RecommendationCard = ({ product }) => (
        <div className="bg-white p-4 rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-[1.02] border border-gray-100">
            <img 
                src={product.imageUrl} 
                alt={product.name} 
                className="w-full h-24 object-contain rounded-md mb-3 bg-gray-50"
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/f0f0f0/666666?text=Image+Error'; }}
            />
            <p className="text-sm font-semibold text-gray-800 truncate">{product.name}</p>
            <p className="text-xs text-indigo-600 font-medium my-1">{product.category}</p>
            <p className="text-lg font-bold text-pink-600">${product.price.toFixed(2)}</p>
            <button className="mt-3 w-full text-xs py-1.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition">View Product</button>
        </div>
    );

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-xl font-medium text-gray-600">Loading Application...</div>;
    }
    
    if (!currentProduct) {
        return <div className="min-h-screen flex items-center justify-center text-xl font-medium text-red-500">Error: Current Product not found (ID: {currentProductId}).</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-[Inter]">
            <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-2xl p-6 md:p-10">
                
                <h1 className="text-3xl font-bold text-indigo-700 mb-8 border-b pb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 inline-block mr-2 text-pink-600 align-text-bottom">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" />
                    </svg>
                    AI Recommendation System Demo
                </h1>
                
                {/* Current Product Context */}
                <div className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-200 mb-10 shadow-md">
                    <h2 className="text-lg font-semibold text-gray-700 mb-2">You are viewing:</h2>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <img 
                                src={currentProduct.imageUrl} 
                                alt={currentProduct.name} 
                                className="w-16 h-16 object-contain rounded-lg bg-white p-1 shadow-sm"
                            />
                            <div>
                                <p className="text-xl font-bold text-indigo-800">{currentProduct.name}</p>
                                <p className="text-sm text-indigo-600">Category: {currentProduct.category}</p>
                            </div>
                        </div>
                        {/* New Purchase Simulation Button */}
                        <button
                            onClick={() => simulatePurchase(currentProductId)}
                            className="flex items-center px-4 py-2 bg-pink-500 text-white font-semibold rounded-full shadow-lg hover:bg-pink-600 transition transform hover:scale-[1.05] active:scale-[0.98]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-1">
                                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clipRule="evenodd" />
                            </svg>
                            Simulate Purchase
                        </button>
                    </div>
                    <div className="mt-4 border-t pt-4 text-xs space-y-1">
                        <p className="text-gray-500">Current User ID: <span className="font-mono text-gray-600">{userId}</span></p>
                        <p className="text-gray-500">Purchase History fetched: <span className="font-bold text-indigo-500">{purchaseHistory.length} unique items</span></p>
                    </div>
                </div>

                {/* Recommendation Carousel */}
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-2 text-pink-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 19.04a2.25 2.25 0 0 1 1.107-2.485l.812-.49a4.5 4.5 0 0 0 2.108-4.757 1.5 1.5 0 0 1-.359-.727 9.5 9.5 0 0 1 .19-1.373C21.644 1.765 19.07 1 12 1S2.356 1.765 2.923 8.208a9.5 9.5 0 0 1 .19 1.373 1.5 1.5 0 0 1-.359.727 4.5 4.5 0 0 0 2.108 4.757l.812.49a2.25 2.25 0 0 1 1.107 2.485L8.958 21.672M12 21.75V23" />
                    </svg>
                    Recommended for You
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {recommendations.length > 0 ? (
                        recommendations.map(product => (
                            <RecommendationCard key={product.id} product={product} />
                        ))
                    ) : (
                        <p className="text-gray-500 italic col-span-4">No specific recommendations found. Displaying popular items instead.</p>
                    )}
                    {/* Placeholder for the 4th slot if recommendations are less than 3 */}
                    {recommendations.length < 4 && (
                        <div className="hidden lg:block p-4 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-center text-gray-500 italic">
                            Recommendation Logic Slot
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default App;

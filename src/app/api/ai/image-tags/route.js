import React, { useState, useEffect } from 'react';

// --- CONFIGURATION CONSTANTS ---
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
const API_KEY = ""; // Canvas will populate this key at runtime

// Helper function to implement exponential backoff for API retries
const fetchWithExponentialBackoff = async (url, options, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && response.status === 429 && i < retries - 1) {
                // Too Many Requests, retry
                console.warn(`Rate limit exceeded, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
                continue;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (i === retries - 1) {
                console.error("API call failed after all retries:", error);
                throw error;
            }
            console.error(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
};

// --- SIMULATED SERVER-SIDE LOGIC ---
// This mimics your /api/ai/image-tags route. It takes Base64 image data.
const generateImageTags = async (base64ImageData) => {
    // 1. Define the AI Persona and Rules (System Prompt)
    const systemPrompt = "You are an expert product tagging assistant for a major e-commerce marketplace. Analyze the image and provide 10 highly specific, SEO-friendly tags/keywords. Output ONLY a comma-separated list of tags. Do not include any other text, numbers, or markdown formatting.";

    // 2. Construct the User Query and Inline Image Data
    const prompt = "Generate a comma-separated list of product tags for this image (material, style, color, use case, related products, specific items, etc.)";
    
    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "image/png", // Assuming PNG or JPEG
                            data: base64ImageData
                        }
                    }
                ]
            }
        ],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    try {
        const response = await fetchWithExponentialBackoff(`${API_URL}?key=${API_KEY}`, options);
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "No tags could be generated.";
        
        // Clean and parse the comma-separated output into an array of tags
        return text.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    } catch (error) {
        console.error("Error generating tags:", error);
        return ["error", "api-failed", "try-again"];
    }
};


const App = () => {
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [base64Image, setBase64Image] = useState('');
    const [generatedTags, setGeneratedTags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('Upload a product image to begin tagging.');

    // Utility to convert file to Base64
    const getBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    // Handler for file input change
    const handleFileChange = async (file) => {
        if (file && file.type.startsWith('image/')) {
            const base64DataUrl = await getBase64(file);
            setImagePreviewUrl(base64DataUrl);
            // Extract the base64 string part after the MIME type prefix
            setBase64Image(base64DataUrl.split(',')[1]);
            setStatus(`Image loaded: ${file.name}. Ready to generate tags.`);
            setGeneratedTags([]);
        } else {
            setStatus('Please upload a valid image file (PNG or JPEG).');
            setImagePreviewUrl('');
            setBase64Image('');
        }
    };

    // Handler for the drag-and-drop zone
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        handleFileChange(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Handler for generating tags
    const handleGenerateTags = async () => {
        if (!base64Image) {
            setStatus('Please upload an image before generating tags.');
            return;
        }

        setIsLoading(true);
        setStatus('Analyzing image and generating tags...');
        setGeneratedTags([]);

        try {
            const tags = await generateImageTags(base64Image);
            setGeneratedTags(tags);
            setStatus(`Successfully generated ${tags.length} tags.`);
        } catch (error) {
            setStatus('Error: Failed to connect to the AI service.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handler to remove a tag
    const handleRemoveTag = (tagToRemove) => {
        setGeneratedTags(prev => prev.filter(tag => tag !== tagToRemove));
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-start justify-center p-8 font-[Inter]">
            <div className="w-full max-w-5xl bg-white shadow-2xl rounded-2xl p-6 md:p-10">
                
                <h1 className="text-3xl font-bold text-indigo-700 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 inline-block mr-2 text-pink-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.405a3.75 3.75 0 0 1-.39 2.083L7 16.5H4.516l-.002-1.282a.75.75 0 0 0-.7-.718H1.5v-2.25H3.25a.75.75 0 0 0 .75-.75V8.25a.75.75 0 0 0-.75-.75H1.5V5.25h1.75a.75.75 0 0 0 .75-.75V3.104a.75.75 0 0 1 1.018-.687L12 8.618l5.232-6.198a.75.75 0 0 1 1.018.687v17.792a.75.75 0 0 1-1.018.687L12 15.382l-5.232 6.198a.75.75 0 0 1-1.018-.687V18.75h1.75a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75H4.516V12.75H7v-1.75a.75.75 0 0 0-.75-.75H4.516V9.75H7V7.5H9.75a.75.75 0 0 0 .75-.75V5.25H12V3.104a.75.75 0 0 1 1.018-.687L19 8.618l5.232-6.198a.75.75 0 0 1 1.018.687v17.792a.75.75 0 0 1-1.018.687L19 15.382l-5.232 6.198a.75.75 0 0 1-1.018-.687V18.75h1.75a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75H14.25V12.75H16.5v-1.75a.75.75 0 0 0-.75-.75H14.25V9.75H16.5V7.5H19.5" />
                    </svg>
                    AI Vision Tagging Tool
                </h1>
                <p className="text-gray-600 mb-8 border-b pb-4">
                    Instantly analyze product images using Gemini to generate descriptive, actionable keywords for better discovery.
                </p>

                <div className="grid md:grid-cols-3 gap-8">
                    
                    {/* Image Upload Area (Span 1) */}
                    <div className="md:col-span-1 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-700">1. Upload Image</h2>
                        
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className={`p-6 border-2 border-dashed ${imagePreviewUrl ? 'border-indigo-400' : 'border-gray-300'} rounded-lg text-center cursor-pointer transition hover:border-indigo-500`}
                            onClick={() => document.getElementById('file-upload').click()}
                        >
                            {imagePreviewUrl ? (
                                <img src={imagePreviewUrl} alt="Product Preview" className="max-h-64 w-full object-contain rounded-md mx-auto" />
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto text-gray-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.559-4.32a.75.75 0 0 1 .417 1.03l-3.35 6.641a.75.75 0 0 1-1.129.07l-2.499-1.341a.75.75 0 0 0-.821.144l-2.73 2.73l-1.574-1.574a.75.75 0 0 1-.416-.543V13.75a.75.75 0 0 1 .75-.75H4.5a.75.75 0 0 0 .75-.75V11.25a.75.75 0 0 0-.75-.75H3.75a.75.75 0 0 1-.75-.75V8.25a.75.75 0 0 1 .75-.75h1.75a.75.75 0 0 0 .75-.75V5.25a.75.75 0 0 1 .75-.75h1.75a.75.75 0 0 0 .75-.75V3.75" />
                                    </svg>
                                    <p className="text-sm text-gray-500 mt-2">Drag and drop an image, or click to select.</p>
                                    <p className="text-xs text-gray-400">PNG or JPEG only. Max 5MB.</p>
                                </>
                            )}
                            
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                accept="image/png, image/jpeg"
                                onChange={(e) => handleFileChange(e.target.files[0])}
                            />
                        </div>

                        <button
                            onClick={handleGenerateTags}
                            disabled={isLoading || !base64Image}
                            className="w-full py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg shadow-lg transition duration-300 transform hover:scale-[1.01] disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                                    <path fillRule="evenodd" d="M15.312 8.75A8.25 8.25 0 1 0 2.25 12.599v-.598L2.57 12h2.203a.75.75 0 0 1 .743.682l.068 1.954a.75.75 0 0 0 1.5.053l.366-1.57.295-.157a.75.75 0 0 1 1.102.72l-.08 1.488a.75.75 0 0 0 1.5.084l.366-1.89a.75.75 0 0 1 1.096-.18l.295.157 1.258 1.594a.75.75 0 0 0 1.102.72l.08-1.488a.75.75 0 0 0-.417-.723l-1.258-.295a.75.75 0 0 1-.945-.494l-.366-1.57a.75.75 0 0 1 .374-.838l.295-.157 1.258-1.594a.75.75 0 0 0 .584-1.272l-1.258-.295a.75.75 0 0 1-.945-.494l-.366-1.57a.75.75 0 0 1 .374-.838l.295-.157 1.258-1.594a.75.75 0 0 0 .584-1.272l-1.258-.295a.75.75 0 0 1-.945-.494l-.366-1.57a.75.75 0 0 1 .374-.838l.295-.157 1.258-1.594a.75.75 0 0 0 .584-1.272l-1.258-.295a.75.75 0 0 1-.945-.494l-.366-1.57a.75.75 0 0 1 .374-.838l.295-.157 1.258-1.594a.75.75 0 0 0 .584-1.272l-1.258-.295a.75.75 0 0 1-.945-.494l-.366-1.57a.75.75 0 0 1 .374-.838l.295-.157 1.258-1.594a.75.75 0 0 0 .584-1.272l-1.258-.295a.75.75 0 0 1-.945-.494l-.366-1.57a.75.75 0 0 1 .374-.838l.295-.157 1.258-1.594a.75.75 0 0 0 .584-1.272l-1.258-.295a.75.75 0 0 1-.945-.494l-.366-1.57a.75.75 0 0 1 .374-.838l.295-.157 1.258-1.594a.75.75 0 0 0 .584-1.272L17.5 7.75a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 0 .75-.75V5.25a.75.75 0 0 1-.75-.75h-.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75H16.5a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75H2.25a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75H.75a.75.75 0 0 0-.75.75V20.25a.75.75 0 0 1-.75.75H.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-.75.75H.75a.75.75 0 0 0-.75.75V22.5" clipRule="evenodd" />
                                </svg>
                            )}
                            {isLoading ? 'Analyzing Image...' : 'Generate Tags from Image'}
                        </button>

                    </div>
                    
                    {/* Tag Output Area (Span 2) */}
                    <div className="md:col-span-2 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-700">2. Review & Save Tags</h2>
                        
                        <div className={`p-4 rounded-lg shadow-inner ${status.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'}`}>
                            <p className="text-sm font-medium">{status}</p>
                        </div>
                        
                        <div className="min-h-[150px] p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
                            {generatedTags.length === 0 && !isLoading && (
                                <p className="text-gray-500 text-sm italic">Tags will appear here after generation. You can click on a tag to remove it.</p>
                            )}
                            
                            <div className="flex flex-wrap gap-2">
                                {generatedTags.map((tag) => (
                                    <span 
                                        key={tag} 
                                        className="inline-flex items-center px-3 py-1 text-sm font-medium bg-pink-100 text-pink-800 rounded-full cursor-pointer transition hover:bg-pink-200"
                                        onClick={() => handleRemoveTag(tag)}
                                    >
                                        {tag}
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1.5 text-pink-500 hover:text-pink-600">
                                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                        </svg>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <button
                            // This would be the function to save the 'generatedTags' array 
                            // to the 'tags' field of your product document in Firestore.
                            onClick={() => console.log('Saving Tags Array to Firestore:', generatedTags)}
                            disabled={generatedTags.length === 0 || isLoading}
                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg transition duration-300 disabled:bg-gray-400"
                        >
                            Save {generatedTags.length} Tags to Product Metadata
                        </button>
                        
                    </div>
                </div>

            </div>
        </div>
    );
};

export default App;

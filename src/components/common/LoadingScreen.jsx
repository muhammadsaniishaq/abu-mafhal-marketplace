import React, { useState, useEffect } from 'react';

const LoadingScreen = () => {
    const [status, setStatus] = useState("Initializing Abu Mafhal...");
    const [isSlow, setIsSlow] = useState(false);

    const messages = [
        "Initializing engine...",
        "Connecting to secure servers...",
        "Synchronizing your profile...",
        "Fetching marketplace updates...",
        "Preparing the experience..."
    ];

    useEffect(() => {
        let msgIndex = 0;
        const msgInterval = setInterval(() => {
            msgIndex = (msgIndex + 1) % messages.length;
            setStatus(messages[msgIndex]);
        }, 2000);

        const slowTimeout = setTimeout(() => {
            setIsSlow(true);
        }, 5000);

        return () => {
            clearInterval(msgInterval);
            clearTimeout(slowTimeout);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-gray-900">
            <div className="relative">
                {/* Visual Pulse Effect */}
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-20"></div>
                <img
                    src="/logo.png"
                    alt="Logo"
                    className="relative w-32 h-32 object-contain animate-pulse shadow-xl rounded-full"
                    onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/150?text=Abu+Mafhal';
                    }}
                />
            </div>

            <div className="mt-8 text-center">
                <p className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    {status}
                </p>

                <div className="w-48 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto">
                    <div className="h-full bg-blue-600 animate-progress origin-left"></div>
                </div>

                {isSlow && (
                    <p className="mt-4 text-orange-500 animate-bounce text-sm font-medium">
                        Connection seems slow. Hang in there!
                    </p>
                )}
            </div>

            <style>{`
                @keyframes progress {
                    0% { transform: scaleX(0); }
                    50% { transform: scaleX(0.7); }
                    100% { transform: scaleX(1); }
                }
                .animate-progress {
                    animation: progress 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default LoadingScreen;

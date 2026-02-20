import React, { useEffect } from 'react';

const MobileLoader = () => {
    useEffect(() => {
        const checkAndRedirect = () => {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isForcedWeb = window.location.search.indexOf('force=web') !== -1;

            if (isMobile && !isForcedWeb) {
                console.log("MobileLoader: Redirecting to /mobile...");
                window.location.replace('/mobile');
            }
        };

        const interval = setInterval(checkAndRedirect, 1000);
        checkAndRedirect();

        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
        }}>
            <div style={{
                width: '50px',
                height: '50px',
                border: '5px solid #f3f3f3',
                borderTop: '5px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ fontFamily: 'sans-serif', marginTop: '20px' }}>Loading Mobile Experience...</h2>
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default MobileLoader;

import React, { useEffect } from 'react';

const MobileLoader = () => {
    useEffect(() => {
        window.location.replace('/mobile');
    }, []);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#0A192F',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
            color: '#FFFFFF',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                width: '46px',
                height: '46px',
                border: '3.5px solid rgba(255,255,255,0.12)',
                borderTop: '3.5px solid #F59E0B',
                borderRadius: '50%',
                animation: 'spin 0.75s linear infinite'
            }} />
            <p style={{ marginTop: '16px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.4px', color: '#F1F5F9' }}>
                Opening Abu Mafhal Mobile...
            </p>
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

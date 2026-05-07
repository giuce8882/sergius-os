import React from 'react';

const GlassPanel = ({ children, className = '' }) => {
    return (
        <div className={`glass-panel p-4 md:p-6 w-full ${className}`}>
            {children}
        </div>
    );
};

export default GlassPanel;

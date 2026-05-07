import React from 'react';

const GlassPanel = ({ children, className = '' }) => {
    return (
        <div className={`glass-panel p-6 ${className}`}>
            {children}
        </div>
    );
};

export default GlassPanel;

import React from 'react';
import './Spinner.css';

function Spinner({ size = 'medium', className = '' }) {
    return (
        <div className={`spinner-container ${className}`}>
            <div className={`spinner spinner-${size}`}></div>
        </div>
    );
}

export default Spinner;

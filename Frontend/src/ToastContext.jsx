import React, { createContext, useState, useContext, useCallback } from 'react';
import './Toast.css';

const ToastContext = createContext();

export const useToast = () => {
    return useContext(ToastContext);
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'error', duration = 4000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        // First trigger the exit animation
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        
        // Then completely remove it after the animation duration (300ms)
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'success': return 'fa-solid fa-circle-check';
            case 'info': return 'fa-solid fa-circle-info';
            case 'error':
            default: return 'fa-solid fa-circle-exclamation';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div 
                        key={toast.id} 
                        className={`toast toast-${toast.type} ${toast.exiting ? 'toast-exiting' : ''}`}
                    >
                        <i className={`toast-icon ${getIcon(toast.type)}`}></i>
                        <span>{toast.message}</span>
                        <button className="toast-close" onClick={() => removeToast(toast.id)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

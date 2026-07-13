import React, { useEffect } from 'react';
import './ShortcutsModal.css';

function ShortcutsModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="shortcuts-overlay" onClick={onClose}>
            <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
                <div className="shortcuts-header">
                    <h2>Keyboard Shortcuts</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="shortcuts-content">
                    <div className="shortcut-row">
                        <span className="shortcut-desc">New Chat</span>
                        <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>K</kbd></span>
                    </div>
                    <div className="shortcut-row">
                        <span className="shortcut-desc">Show Shortcuts</span>
                        <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>/</kbd></span>
                    </div>
                    <div className="shortcut-row">
                        <span className="shortcut-desc">Send Message</span>
                        <span className="shortcut-keys"><kbd>Enter</kbd></span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ShortcutsModal;

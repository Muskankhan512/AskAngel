import React, { useState } from 'react';
import './ShareModal.css';

function ShareModal({ isOpen, onClose, shareId, onRevoke }) {
    if (!isOpen) return null;

    const [copied, setCopied] = useState(false);
    const shareLink = `${window.location.origin}/shared/${shareId}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <div className="share-overlay" onClick={onClose}>
            <div className="share-modal" onClick={e => e.stopPropagation()}>
                <div className="share-header">
                    <h2>Share this Chat</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="share-content">
                    <p className="share-desc">Anyone with this link can view this conversation as a read-only page.</p>
                    <div className="share-link-box">
                        <input type="text" readOnly value={shareLink} />
                        <button className="copy-btn" onClick={handleCopy}>
                            {copied ? <i className="fa-solid fa-check"></i> : <i className="fa-regular fa-copy"></i>}
                        </button>
                    </div>
                </div>
                <div className="share-footer">
                    <button className="revoke-btn" onClick={onRevoke}>
                        <i className="fa-solid fa-link-slash"></i> Stop Sharing
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ShareModal;

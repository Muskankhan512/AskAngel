import { useState, useContext, useRef } from "react";
import { MyContext } from "./MyContext.jsx";
import "./ProfileModal.css";

function ProfileModal({ onClose }) {
    const { user, setUser, token, handleLogout } = useContext(MyContext);
    const [name, setName] = useState(user?.name || "");
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError("Please upload a valid image file.");
            return;
        }
        
        // Convert image to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result);
            setError("");
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError("Name cannot be empty.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/auth/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name, avatar: avatarPreview })
            });

            if (response.status === 401) {
                handleLogout();
                return;
            }

            const data = await response.json();
            if (response.ok) {
                setUser(data.user);
                localStorage.setItem("user", JSON.stringify(data.user));
                onClose();
            } else {
                setError(data.error || "Failed to update profile.");
            }
        } catch (err) {
            console.error(err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modalOverlay" onClick={onClose}>
            <div className="profileModalContent" onClick={e => e.stopPropagation()}>
                <div className="profileModalHeader">
                    <h2>Profile Settings</h2>
                    <button className="closeBtn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
                </div>
                
                <div className="profileModalBody">
                    {error && <div className="profileError">{error}</div>}
                    
                    <div className="avatarSection">
                        <div className="avatarPreviewWrapper">
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" className="avatarPreviewImage" />
                            ) : (
                                <div className="avatarPlaceholder"><i className="fa-solid fa-user"></i></div>
                            )}
                            <div className="avatarEditOverlay" onClick={() => fileInputRef.current?.click()}>
                                <i className="fa-solid fa-camera"></i>
                            </div>
                        </div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            style={{display: 'none'}} 
                            onChange={handleFileChange} 
                        />
                        <button className="removeAvatarBtn" onClick={() => setAvatarPreview("")}>
                            Remove Picture
                        </button>
                    </div>

                    <div className="inputGroup">
                        <label>Display Name</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="Enter your name" 
                            autoFocus
                        />
                    </div>
                </div>

                <div className="profileModalFooter">
                    <button className="btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="btn-save" onClick={handleSave} disabled={loading}>
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProfileModal;

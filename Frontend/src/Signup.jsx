import { useState } from "react";
import { useToast } from "./ToastContext";
import Spinner from "./Spinner";
import "./Auth.css";

function Signup({ onSwitch, onLogin }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            if (!res.ok) { 
                showToast(data.error || "An account with this email already exists. Try logging in instead.", "error"); 
                return; 
            }
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            onLogin(data.user);
        } catch (err) {
            showToast("Something went wrong. Please try again in a moment.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="authPage">
            <div className="authCard">
                <div className="authLogo">
                    <i className="fa-solid fa-robot"></i>
                </div>
                <h1 className="authTitle">Create account</h1>
                <p className="authSubtitle">Join AskAngel and start chatting</p>

                <form onSubmit={handleSubmit} className="authForm">
                    <div className="authField">
                        <label>Name</label>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="authField">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="authField">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="authBtn" disabled={loading}>
                        {loading ? <><Spinner size="small" /> Creating account...</> : "Create Account"}
                    </button>
                </form>

                <p className="authSwitch">
                    Already have an account?{" "}
                    <span onClick={onSwitch}>Sign in</span>
                </p>
            </div>
        </div>
    );
}

export default Signup;

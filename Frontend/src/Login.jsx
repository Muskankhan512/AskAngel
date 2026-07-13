import { useState } from "react";
import "./Auth.css";

function Login({ onSwitch, onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error); return; }
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            onLogin(data.user);
        } catch (err) {
            setError("Network error. Is the backend running?");
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
                <h1 className="authTitle">Welcome back</h1>
                <p className="authSubtitle">Sign in to continue to AskAngel</p>

                {error && <div className="authError"><i className="fa-solid fa-circle-exclamation"></i> {error}</div>}

                <form onSubmit={handleSubmit} className="authForm">
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
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="authBtn" disabled={loading}>
                        {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Signing in...</> : "Sign In"}
                    </button>
                </form>

                <p className="authSwitch">
                    Don't have an account?{" "}
                    <span onClick={onSwitch}>Sign up</span>
                </p>
            </div>
        </div>
    );
}

export default Login;

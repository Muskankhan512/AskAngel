import { useState } from "react";
import "./Auth.css";

function Signup({ onSwitch, onLogin }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await fetch("http://localhost:8080/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
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
                <h1 className="authTitle">Create account</h1>
                <p className="authSubtitle">Join AskAngel and start chatting</p>

                {error && <div className="authError"><i className="fa-solid fa-circle-exclamation"></i> {error}</div>}

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
                        {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Creating account...</> : "Create Account"}
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

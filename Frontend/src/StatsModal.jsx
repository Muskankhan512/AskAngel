import React, { useState, useEffect, useContext } from 'react';
import './StatsModal.css';
import { MyContext } from './MyContext.jsx';
import Spinner from './Spinner.jsx';

function StatsModal({ isOpen, onClose }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const { token, handleLogout } = useContext(MyContext);

    useEffect(() => {
        if (isOpen) {
            fetchStats();
        }
    }, [isOpen]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/stats", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 401) {
                handleLogout();
                return;
            }
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error("Failed to fetch stats:", err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    let maxMessagesPerDay = 1;
    let daysKeys = [];
    if (stats?.messagesPerDay) {
        daysKeys = Object.keys(stats.messagesPerDay).sort();
        maxMessagesPerDay = Math.max(1, ...Object.values(stats.messagesPerDay));
    }

    return (
        <div className="statsOverlay" onClick={onClose}>
            <div className="statsModal" onClick={e => e.stopPropagation()}>
                <div className="statsHeader">
                    <h2><i className="fa-solid fa-chart-simple" style={{marginRight: '8px', color: 'var(--accent-color)'}}></i> Your Insights</h2>
                    <button className="closeBtn" onClick={onClose}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
                
                {loading || !stats ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 0' }}>
                        <Spinner size="large" />
                        <p style={{ color: 'var(--text-secondary)' }}>Loading stats...</p>
                    </div>
                ) : stats.totalMessages === 0 ? (
                    <div className="emptyState" style={{ padding: '40px 0' }}>
                        <i className="fa-solid fa-chart-simple"></i>
                        <p>Start chatting to see your stats here!</p>
                    </div>
                ) : (
                    <>
                        <div className="statsGrid">
                            <div className="statCard">
                                <div className="statValue">{stats.totalThreads}</div>
                                <div className="statLabel">Total Chats</div>
                            </div>
                            <div className="statCard">
                                <div className="statValue">{stats.totalMessages}</div>
                                <div className="statLabel">Messages Sent</div>
                            </div>
                            <div className="statCard">
                                <div className="statValue" style={{fontSize: '1.2rem', padding: '5px 0'}}>{stats.mostUsedPersona}</div>
                                <div className="statLabel">Top Persona</div>
                            </div>
                            <div className="statCard">
                                <div className="statValue" style={{fontSize: '1.2rem', padding: '5px 0'}}>
                                    {new Date(stats.accountCreationDate).toLocaleDateString()}
                                </div>
                                <div className="statLabel">Member Since</div>
                            </div>
                        </div>

                        <div className="statsChart">
                            <h3>Messages in Last 7 Days</h3>
                            <div className="chartBars">
                                {daysKeys.map(date => {
                                    const count = stats.messagesPerDay[date];
                                    const heightPercent = (count / maxMessagesPerDay) * 100;
                                    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                                    
                                    return (
                                        <div key={date} className="chartBarContainer" title={`${count} messages on ${date}`}>
                                            <div className="chartBar" style={{ height: `${heightPercent}%` }}></div>
                                            <div className="chartLabel">{dayName}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default StatsModal;

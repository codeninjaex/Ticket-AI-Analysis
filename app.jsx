import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard';

const API = 'http://localhost:5000/api';

export default function App() {
    const [status, setStatus] = useState('idle'); // idle, uploading, running, complete, error
    const [message, setMessage] = useState('');
    const [data, setData] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const handleUpload = async (file) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setStatus('uploading');
        setMessage('Uploading file and starting analysis...');

        try {
            const res = await axios.post(`${API}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === 'complete') {
                setMessage('Fetching results...');
                await fetchDashboardData();
            } else {
                setStatus(res.data.status);
                setMessage(res.data.message);
            }
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.message || 'Upload failed. Ensure backend is running.');
            console.error(err);
        }
    };

    const fetchDashboardData = useCallback(async () => {
        try {
            const [summary, hh, effort, breakdown, volume] = await Promise.all([
                axios.get(`${API}/summary`),
                axios.get(`${API}/heavy-hitters?top_n=15`),
                axios.get(`${API}/effort`),
                axios.get(`${API}/category-breakdown`),
                axios.get(`${API}/volume-trends`)
            ]);
            setData({
                summary: summary.data,
                heavyHitters: hh.data,
                effort: effort.data,
                breakdown: breakdown.data,
                volume: volume.data
            });
            setStatus('complete');
        } catch (err) {
            console.error('Fetch error:', err);
            setStatus('error');
            setMessage('Failed to load dashboard data.');
        }
    }, []);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
        }
    };

    const downloadExcel = () => {
        window.open(`${API}/download-excel`, '_blank');
    };

    const reset = () => {
        setStatus('idle');
        setData(null);
        setMessage('');
    };

    if (status !== 'complete' || !data) {
        return (
            <div className="init-screen">
                <div className="init-card">
                    <h1>🎫 Ticket AI Analyzer</h1>
                    <p className="subtitle">Categorize intelligently, extract effort, and visualize trends with Gemini AI.</p>

                    <div
                        className={`upload-zone ${dragActive ? 'active' : ''} ${status === 'uploading' ? 'loading' : ''}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        {status === 'uploading' ? (
                            <div className="loader-container">
                                <div className="spinner"></div>
                                <p>{message}</p>
                            </div>
                        ) : (
                            <>
                                <div className="upload-icon">📁</div>
                                <p>Drag and drop your <strong>CSV file</strong> here</p>
                                <span>or</span>
                                <input
                                    type="file"
                                    id="file-upload"
                                    accept=".csv"
                                    onChange={(e) => handleUpload(e.target.files[0])}
                                    hidden
                                />
                                <label htmlFor="file-upload" className="upload-btn">Browse Files</label>
                            </>
                        )}
                    </div>

                    {status === 'error' && (
                        <div className="error-box">
                            <p>❌ {message}</p>
                            <button onClick={reset}>Try Again</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return <Dashboard data={data} onDownload={downloadExcel} onRefresh={fetchDashboardData} onReset={reset} />;
}

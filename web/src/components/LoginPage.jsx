import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '../api/client';

export function LoginPage({ onLoginSuccess }) {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password) return;

        setIsLoading(true);
        setError(false);

        try {
            await apiClient.post('/auth/login', { password });
            onLoginSuccess();
        } catch (err) {
            setError(true);
            setTimeout(() => setError(false), 500); // Reset for shake animation
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#f5f5f7] flex items-center justify-center p-4">
            {/* Background Abstract Shapes (Optional, subtle) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-brand-200/30 rounded-full blur-[100px]" />
                <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[60%] bg-blue-200/20 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="relative bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl p-8 w-full max-w-sm"
            >
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-brand-600 tracking-tighter drop-shadow-sm font-sans">Photomato</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <motion.div
                            animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            className="relative"
                        >
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="请输入访问密码"
                                className={`w-full px-4 py-3 rounded-xl bg-white/60 border ${error ? 'border-red-300 focus:border-red-500 ring-2 ring-red-100' : 'border-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'} outline-none transition-all placeholder:text-neutral-400`}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                )}
                            </button>
                        </motion.div>
                        {error && <p className="text-xs text-red-500 text-center font-medium">密码错误，请重试</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !password}
                        className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            "立即解锁"
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}

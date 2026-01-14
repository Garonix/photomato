import React, { createContext, useContext, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AlertDialogContext = createContext(null);

export function AlertDialogProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState({ title: '', description: '', onConfirm: () => { }, confirmText: 'Confirm', cancelText: 'Cancel', isDestructive: false });
    const resolveRef = useRef(null);

    const confirm = ({ title, description, confirmText = '确定', cancelText = '取消', isDestructive = false }) => {
        return new Promise((resolve) => {
            setConfig({
                title,
                description,
                confirmText,
                cancelText,
                isDestructive,
                onConfirm: () => {
                    resolve(true); // Confirmed
                    setIsOpen(false);
                }
            });
            resolveRef.current = () => {
                resolve(false); // Cancelled
                setIsOpen(false);
            };
            setIsOpen(true);
        });
    };

    return (
        <AlertDialogContext.Provider value={{ confirm }}>
            {children}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => resolveRef.current?.()}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-neutral-100"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-neutral-900 mb-2">{config.title}</h3>
                                <p className="text-neutral-500 text-sm leading-relaxed">{config.description}</p>
                            </div>
                            <div className="bg-neutral-50 p-4 flex justify-end gap-3 border-t border-neutral-100">
                                <button
                                    onClick={() => resolveRef.current?.()}
                                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/50 rounded-lg transition-colors"
                                >
                                    {config.cancelText}
                                </button>
                                <button
                                    onClick={config.onConfirm}
                                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all transform active:scale-95 ${config.isDestructive
                                            ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                            : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'
                                        }`}
                                >
                                    {config.confirmText}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AlertDialogContext.Provider>
    );
}

export const useAlertDialog = () => {
    const context = useContext(AlertDialogContext);
    if (!context) throw new Error('useAlertDialog must be used within an AlertDialogProvider');
    return context;
};

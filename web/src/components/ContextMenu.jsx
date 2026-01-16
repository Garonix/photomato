import React from 'react';

/**
 * ContextMenu - 右键上下文菜单组件
 */
export function ContextMenu({ x, y, photo, onAction, onClose }) {
    if (!photo) return null;

    const menuItems = [
        {
            key: 'copy',
            label: '复制链接',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            ),
        },
        {
            key: 'copyImage',
            label: '复制图片',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            ),
        },
        {
            key: 'download',
            label: '下载',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            ),
        },
        {
            key: 'move',
            label: '移动...',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    <line x1="12" y1="11" x2="12" y2="17"></line>
                    <polyline points="9 14 12 11 15 14"></polyline>
                </svg>
            ),
        },
    ];

    return (
        <div
            className="fixed z-50 bg-white border border-neutral-100 shadow-xl rounded-md py-1 w-48 text-sm text-neutral-700 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
        >
            {menuItems.map((item) => (
                <button
                    key={item.key}
                    onClick={() => {
                        onAction?.(item.key, photo);
                        onClose?.();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-neutral-50 hover:text-brand-600 flex items-center gap-2"
                >
                    {item.icon}
                    {item.label}
                </button>
            ))}
            <div className="h-px bg-neutral-100 my-1"></div>
            <button
                onClick={() => {
                    onAction?.('delete', photo);
                    onClose?.();
                }}
                className="w-full text-left px-4 py-2 hover:bg-brand-50 text-brand-600 flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                删除
            </button>
        </div>
    );
}

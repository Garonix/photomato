import React from 'react';

/**
 * UploadOverlay - 上传相关 UI 组件
 * 包含拖放覆盖层、上传状态提示
 */

// 拖放覆盖层
export function DragOverlay({ isDragging, uploadStatus }) {
    if (!isDragging && uploadStatus !== 'uploading') return null;

    return (
        <div className="fixed inset-64 right-0 bottom-0 top-0 z-40 bg-white/95 backdrop-blur-md flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
            <div className="text-center p-12 border-2 border-brand-500 border-dashed rounded-3xl">
                {uploadStatus === 'uploading' ? (
                    <>
                        <div className="inline-block w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="font-bold text-brand-600 text-xl">上传中...</p>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                        </div>
                        <p className="font-bold text-2xl text-neutral-800 tracking-tight">松开上传照片</p>
                    </>
                )}
            </div>
        </div>
    );
}

// 上传状态 Toast
export function UploadToast({ status }) {
    if (status === 'success') {
        return (
            <div className="fixed bottom-8 right-8 z-50 bg-white border border-green-200 text-green-700 px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-bounce font-medium">
                <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">✓</span>
                上传成功
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="fixed bottom-8 right-8 z-50 bg-white border border-red-200 text-red-700 px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 font-medium">
                <span className="flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">✕</span>
                上传失败
            </div>
        );
    }

    return null;
}

// 空相册占位
export function EmptyGallery() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-300 border-2 border-dashed border-neutral-200 rounded-3xl bg-neutral-50/30">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-neutral-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
            </div>
            <p className="mb-2 text-lg font-medium text-neutral-400">暂无照片</p>
            <p className="text-sm text-neutral-400">拖放图片到此处上传</p>
        </div>
    );
}

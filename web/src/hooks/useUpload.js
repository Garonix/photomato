import { useState, useEffect, useCallback } from 'react';

/**
 * useUpload - 管理文件上传逻辑的 Hook
 */
export function useUpload({ alias, uploadMutation }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null); // null | 'uploading' | 'success' | 'error'

    // 上传文件
    const uploadFiles = useCallback(async (files) => {
        setUploadStatus('uploading');
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        formData.append('alias', alias);
        try {
            await uploadMutation.mutateAsync({ alias, formData });
            setUploadStatus('success');
            setTimeout(() => setUploadStatus(null), 2000);
        } catch (error) {
            setUploadStatus('error');
            setTimeout(() => setUploadStatus(null), 3000);
        }
    }, [alias, uploadMutation]);

    // 拖拽进入
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    // 拖拽离开
    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    }, []);

    // 拖拽悬停
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    // 放下文件
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        if (files.length === 0) return;
        await uploadFiles(files);
    }, [uploadFiles]);

    // 文件选择器变化
    const handleFileInputChange = useCallback(async (e) => {
        const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        if (files.length === 0) return;
        await uploadFiles(files);
        e.target.value = '';
    }, [uploadFiles]);

    // 粘贴上传
    useEffect(() => {
        const handlePaste = async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const imageFiles = [];
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) imageFiles.push(file);
                }
            }
            if (imageFiles.length > 0) {
                e.preventDefault();
                await uploadFiles(imageFiles);
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [uploadFiles]);

    return {
        isDragging,
        uploadStatus,
        uploadFiles,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleFileInputChange,
    };
}

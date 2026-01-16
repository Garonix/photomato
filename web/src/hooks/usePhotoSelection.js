import { useState, useEffect, useCallback } from 'react';

/**
 * usePhotoSelection - 管理照片多选逻辑的 Hook
 */
export function usePhotoSelection() {
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedPhotos, setSelectedPhotos] = useState(new Set());
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [dragSelectMode, setDragSelectMode] = useState(null); // 'select' or 'deselect'

    // 切换单张照片选中状态
    const togglePhotoSelection = useCallback((photoId) => {
        setSelectedPhotos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(photoId)) {
                newSet.delete(photoId);
            } else {
                newSet.add(photoId);
            }
            return newSet;
        });
    }, []);

    // 添加照片到选中集合
    const addToSelection = useCallback((photoId) => {
        setSelectedPhotos(prev => {
            if (prev.has(photoId)) return prev;
            const newSet = new Set(prev);
            newSet.add(photoId);
            return newSet;
        });
    }, []);

    // 开始拖拽选择
    const handleSelectionMouseDown = useCallback((photoId, forceMode = false) => {
        if (!isSelectMode && !forceMode) return;

        setIsDragSelecting(true);
        const isCurrentlySelected = selectedPhotos.has(photoId);
        const mode = forceMode ? 'select' : (isCurrentlySelected ? 'deselect' : 'select');
        setDragSelectMode(mode);

        setSelectedPhotos(prev => {
            const newSet = new Set(prev);
            if (mode === 'select') {
                newSet.add(photoId);
            } else {
                newSet.delete(photoId);
            }
            return newSet;
        });
    }, [isSelectMode, selectedPhotos]);

    // 拖拽选择时鼠标进入
    const handleSelectionMouseEnter = useCallback((photoId) => {
        if (!isSelectMode || !isDragSelecting || !dragSelectMode) return;
        setSelectedPhotos(prev => {
            const newSet = new Set(prev);
            if (dragSelectMode === 'select') {
                newSet.add(photoId);
            } else {
                newSet.delete(photoId);
            }
            return newSet;
        });
    }, [isSelectMode, isDragSelecting, dragSelectMode]);

    // 退出选择模式
    const exitSelectMode = useCallback(() => {
        setIsSelectMode(false);
        setSelectedPhotos(new Set());
        setIsDragSelecting(false);
        setDragSelectMode(null);
    }, []);

    // 全局鼠标/触摸释放监听
    useEffect(() => {
        const handlePointerUp = () => {
            if (isDragSelecting) {
                setIsDragSelecting(false);
                setDragSelectMode(null);
            }
        };
        window.addEventListener('mouseup', handlePointerUp);
        window.addEventListener('touchend', handlePointerUp);
        return () => {
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('touchend', handlePointerUp);
        };
    }, [isDragSelecting]);

    return {
        isSelectMode,
        setIsSelectMode,
        selectedPhotos,
        setSelectedPhotos,
        isDragSelecting,
        togglePhotoSelection,
        addToSelection,
        handleSelectionMouseDown,
        handleSelectionMouseEnter,
        exitSelectMode,
    };
}

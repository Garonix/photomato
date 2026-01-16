import React, { useState, useEffect, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotos, useUploadPhoto, useDeletePhoto, useMovePhotos } from '../api/hooks';
import { Lightbox } from './Lightbox';
import { useAlertDialog } from '../components/ui/AlertDialog';
import { useToast } from './ui/Toast';
import { MoveDialog } from './MoveDialog';

// Default breakpoints, will be scaled by density factor
const baseBreakpoints = {
    default: 5,
    1920: 5,
    1536: 4,
    1280: 3,
    1024: 3,
    768: 2,
    640: 1
};

export function Gallery({ alias, onControlsReady }) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = usePhotos(alias);
    const uploadMutation = useUploadPhoto();
    const deleteMutation = useDeletePhoto();
    const moveMutation = useMovePhotos();
    const { confirm } = useAlertDialog();
    const { addToast } = useToast();

    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [showMoveDialog, setShowMoveDialog] = useState(false);

    // Multi-select mode state
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedPhotos, setSelectedPhotos] = useState(new Set());
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [dragSelectMode, setDragSelectMode] = useState(null); // 'select' or 'deselect'

    // View mode state: 'masonry' or 'grid'
    const [viewMode, setViewMode] = useState(() => {
        const saved = localStorage.getItem('gallery-view-mode');
        return saved || 'masonry';
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [uploadRotation, setUploadRotation] = useState(0);

    // File upload input ref
    const fileInputRef = useRef(null);

    // Density State (1 = Normal, 0.5 = Sparse, 2 = Dense)
    // Slider range: 0 to 100. Persisted to localStorage.
    const [density, setDensity] = useState(() => {
        const saved = localStorage.getItem('gallery-density');
        return saved !== null ? parseInt(saved) : 50;
    });
    const [activeCols, setActiveCols] = useState(baseBreakpoints);

    // Gap State: Controls spacing between photos (0-32px). Persisted to localStorage.
    const [gap, setGap] = useState(() => {
        const saved = localStorage.getItem('gallery-gap');
        return saved !== null ? parseInt(saved) : 16;
    });

    // Persist density to localStorage
    useEffect(() => {
        localStorage.setItem('gallery-density', density.toString());
    }, [density]);

    // Persist gap to localStorage
    useEffect(() => {
        localStorage.setItem('gallery-gap', gap.toString());
    }, [gap]);

    // Persist view mode to localStorage
    useEffect(() => {
        localStorage.setItem('gallery-view-mode', viewMode);
    }, [viewMode]);

    // Calculate all photos first (to be used in logic below)
    const allPhotos = data?.pages?.flatMap((page) => page.photos ?? []) ?? [];

    // Grid view: items per page (density 0-100 maps to 12-60)
    const itemsPerPage = Math.round(12 + (density / 100) * 48);

    // Grid view: total pages
    const totalPages = Math.max(1, Math.ceil(allPhotos.length / itemsPerPage));

    // Reset currentPage when it exceeds totalPages
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    // Grid view: current page photos
    const displayPhotos = viewMode === 'grid'
        ? allPhotos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : allPhotos;



    // Selection indicator size (w-6 = 24px), used for minimum gap in select mode
    const SELECTION_INDICATOR_SIZE = 24;

    // Effective gap: in select mode, ensure minimum gap for selection indicators
    const effectiveGap = isSelectMode ? Math.max(gap, SELECTION_INDICATOR_SIZE) : gap;

    // Calculate columns based on density
    useEffect(() => {
        // Map 0-100 to a multiplier roughly 0.6x to 2x columns
        const multiplier = 0.6 + (density / 100) * 1.2;

        const newBreakpoints = {};
        for (const [key, val] of Object.entries(baseBreakpoints)) {
            newBreakpoints[key] = Math.max(1, Math.round(val * multiplier));
        }
        setActiveCols(newBreakpoints);
    }, [density]);

    // Register controls with parent (for Header to display)
    useEffect(() => {
        if (onControlsReady) {
            onControlsReady({
                // State values
                isSelectMode,
                selectedCount: selectedPhotos.size,
                viewMode,
                density,
                gap,
                photoCount: allPhotos.length,
                itemsPerPage,
                uploadRotation,
                // Callbacks
                onToggleSelectMode: () => isSelectMode ? exitSelectMode() : setIsSelectMode(true),
                onBatchMove: handleBatchMove,
                onBatchDelete: handleBatchDelete,
                onDensityChange: setDensity,
                onGapChange: setGap,
                onViewModeToggle: () => {
                    setViewMode(prev => prev === 'masonry' ? 'grid' : 'masonry');
                    setCurrentPage(1);
                },
                onUploadClick: () => {
                    setUploadRotation(prev => prev + 90);
                    fileInputRef.current?.click();
                },
            });
        }
    }, [onControlsReady, isSelectMode, selectedPhotos.size, viewMode, density, gap, allPhotos.length, itemsPerPage, uploadRotation]);


    // Context Menu Logic
    const handleContextMenu = (e, photo) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            photo
        });
    };
    const closeContextMenu = () => setContextMenu(null);
    useEffect(() => {
        const handleClick = () => closeContextMenu();
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showMoveDialog) {
                    setShowMoveDialog(false);
                    e.stopPropagation(); // Prevent bubbling if needed
                } else if (isSelectMode) {
                    exitSelectMode();
                } else if (fileInputRef.current) {
                    // Try to reset file input if "upload window" meant forcing focus out, 
                    // but browser file picker handles its own ESC. 
                    // This is just a safety for state.
                    if (uploadStatus === 'uploading') {
                        // Maybe cancel upload? For now just ignore.
                    }
                }
            }
        };
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showMoveDialog, isSelectMode, uploadStatus]);

    const handleMenuAction = async (action) => {
        if (!contextMenu) return;
        const { photo } = contextMenu;
        /* ... Action Logic ... */
        switch (action) {
            case 'copy':
                const url = window.location.origin + `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`;
                navigator.clipboard.writeText(url);
                break;
            case 'copyImage':
                try {
                    const imageUrl = `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`;
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    await navigator.clipboard.write([
                        new ClipboardItem({ [blob.type]: blob })
                    ]);
                } catch (e) {
                    alert("复制图片失败");
                }
                break;
            case 'download':
                const downloadUrl = `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`;
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = photo.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                break;
            case 'delete':
                // Use custom confirm dialog
                const isConfirmed = await confirm({
                    title: "删除确认",
                    description: `确定要删除 "${photo.name}" 吗？此操作不可恢复。`,
                    confirmText: "删除",
                    isDestructive: true
                });

                if (isConfirmed) {
                    try {
                        await deleteMutation.mutateAsync({ alias, path: photo.path });
                    } catch (e) { alert("删除失败"); }
                }
                break;
            case 'move':
                // For single photo move
                setSelectedPhotos(new Set([photo.id])); // Select just this one
                setShowMoveDialog(true);
                break;
        }
        closeContextMenu();
    };

    // Shared upload logic
    const uploadFiles = async (files) => {
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
    };

    // D&D Logic
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget)) return; setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = async (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        if (files.length === 0) return;
        await uploadFiles(files);
    };

    // Handle file input change (for upload button)
    const handleFileInputChange = async (e) => {
        const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        if (files.length === 0) return;
        await uploadFiles(files);
        e.target.value = ''; // Reset input
    };

    // Paste upload handler
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
    }, [alias]);

    // Long press timer ref
    const longPressTimerRef = useRef(null);

    // Multi-select toggle
    const togglePhotoSelection = (photoId) => {
        setSelectedPhotos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(photoId)) {
                newSet.delete(photoId);
            } else {
                newSet.add(photoId);
            }
            return newSet;
        });
    };

    // Add photo to selection (for drag selecting)
    const addToSelection = (photoId) => {
        setSelectedPhotos(prev => {
            if (prev.has(photoId)) return prev;
            const newSet = new Set(prev);
            newSet.add(photoId);
            return newSet;
        });
    };

    // Handle drag selection start
    // forceMode: optional, if provided, bypasses isSelectMode check and force sets mode
    const handleSelectionMouseDown = (photoId, forceMode = false) => {
        if (!isSelectMode && !forceMode) return;

        setIsDragSelecting(true);
        // Determine mode based on first photo's current state
        // If forceMode is true (long press), we usually want to SELECT (start dragging)
        const isCurrentlySelected = selectedPhotos.has(photoId);

        // If forcing, we assume we want to SELECT the item we long-pressed
        const mode = forceMode ? 'select' : (isCurrentlySelected ? 'deselect' : 'select');

        setDragSelectMode(mode);
        // Apply action to first photo
        setSelectedPhotos(prev => {
            const newSet = new Set(prev);
            if (mode === 'select') {
                newSet.add(photoId);
            } else {
                newSet.delete(photoId);
            }
            return newSet;
        });
    };

    // Handle drag selection move (when hovering over a photo while dragging)
    const handleSelectionMouseEnter = (photoId) => {
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
    };

    // Stop drag selection on mouse up / touch end (global listener)
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

    // Handle touch move for drag selection (on the gallery container)
    const handleTouchMove = (e) => {
        if (!isSelectMode || !isDragSelecting) return;

        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);

        // Find the photo container by traversing up
        const photoContainer = element?.closest('[data-photo-id]');
        if (photoContainer) {
            const photoId = photoContainer.dataset.photoId;
            if (photoId) {
                setSelectedPhotos(prev => {
                    const newSet = new Set(prev);
                    if (dragSelectMode === 'select') {
                        newSet.add(photoId);
                    } else {
                        newSet.delete(photoId);
                    }
                    return newSet;
                });
            }
        }
    };

    // Exit select mode
    const exitSelectMode = () => {
        setIsSelectMode(false);
        setSelectedPhotos(new Set());
        setIsDragSelecting(false);
        setDragSelectMode(null);
    };

    // Batch delete
    const handleBatchDelete = async () => {
        if (selectedPhotos.size === 0) return;
        const isConfirmed = await confirm({
            title: "批量删除确认",
            description: `确定要删除选中的 ${selectedPhotos.size} 张照片吗？此操作不可恢复。`,
            confirmText: "删除",
            isDestructive: true
        });
        if (isConfirmed) {
            try {
                const photosToDelete = allPhotos.filter(p => selectedPhotos.has(p.id));
                for (const photo of photosToDelete) {
                    await deleteMutation.mutateAsync({ alias, path: photo.path });
                }
                exitSelectMode();
            } catch (e) {
                alert("部分删除失败");
            }
        }
    };

    // Batch move
    const handleBatchMove = () => {
        if (selectedPhotos.size === 0) return;
        setShowMoveDialog(true);
    };

    const handleConfirmMove = async (destAlias) => {
        const photosToMove = allPhotos.filter(p => selectedPhotos.has(p.id));
        const paths = photosToMove.map(p => p.path);
        try {
            await moveMutation.mutateAsync({
                alias,
                paths,
                destAlias
            });
            addToast({ title: "移动成功", type: "success" });
            exitSelectMode();
        } catch (e) {
            addToast({ title: "移动失败", description: "请稍后重试", type: "error" });
        } finally {
            setShowMoveDialog(false);
        }
    };

    if (status === 'pending') return <div className="flex justify-center h-64 text-neutral-300 animate-pulse mt-12">Loading...</div>;
    if (status === 'error') return <div className="flex justify-center h-64 text-red-500 mt-12">Failed to load.</div>;



    const handleClose = () => setSelectedPhotoIndex(null);
    const handleNext = () => setSelectedPhotoIndex((prev) => (prev + 1 < allPhotos.length ? prev + 1 : prev));
    const handlePrev = () => setSelectedPhotoIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));

    return (
        <div
            className="w-full min-h-full relative p-6 pb-24"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTouchMove={handleTouchMove}
        >
            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white border border-neutral-100 shadow-xl rounded-md py-1 w-48 text-sm text-neutral-700 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => handleMenuAction('copy')} className="w-full text-left px-4 py-2 hover:bg-neutral-50 hover:text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        复制链接
                    </button>
                    <button onClick={() => handleMenuAction('copyImage')} className="w-full text-left px-4 py-2 hover:bg-neutral-50 hover:text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        复制图片
                    </button>
                    <button onClick={() => handleMenuAction('download')} className="w-full text-left px-4 py-2 hover:bg-neutral-50 hover:text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        下载
                    </button>
                    <button onClick={() => handleMenuAction('move')} className="w-full text-left px-4 py-2 hover:bg-neutral-50 hover:text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><polyline points="9 14 12 11 15 14"></polyline></svg>
                        移动...
                    </button>
                    <div className="h-px bg-neutral-100 my-1"></div>
                    <button onClick={() => handleMenuAction('delete')} className="w-full text-left px-4 py-2 hover:bg-brand-50 text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        删除
                    </button>
                </div>
            )}

            {/* D&D Overlay */}
            {(isDragging || uploadStatus === 'uploading') && (
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
                                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                </div>
                                <p className="font-bold text-2xl text-neutral-800 tracking-tight">松开上传照片</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Toasts */}
            {uploadStatus === 'success' && (
                <div className="fixed bottom-8 right-8 z-50 bg-white border border-green-200 text-green-700 px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-bounce font-medium">
                    <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">✓</span> 上传成功
                </div>
            )}
            {uploadStatus === 'error' && (
                <div className="fixed bottom-8 right-8 z-50 bg-white border border-red-200 text-red-700 px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 font-medium">
                    <span className="flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">✕</span> 上传失败
                </div>
            )}

            {/* Hidden file input for upload button */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="image/*"
                multiple
                className="hidden"
            />


            {allPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-300 border-2 border-dashed border-neutral-200 rounded-3xl bg-neutral-50/30">
                    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-neutral-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </div>
                    <p className="mb-2 text-lg font-medium text-neutral-400">暂无照片</p>
                    <p className="text-sm text-neutral-400">拖放图片到此处上传</p>
                </div>
            ) : viewMode === 'masonry' ? (
                /* Masonry View */
                <Masonry
                    breakpointCols={activeCols}
                    className="flex w-auto"
                    columnClassName="bg-clip-padding"
                    style={{ marginLeft: `-${effectiveGap}px` }}
                >
                    {displayPhotos.map((photo, index) => (
                        <motion.div
                            layoutId={photo.id}
                            key={photo.id}
                            className="group break-inside-avoid"
                            style={{ paddingLeft: `${effectiveGap}px`, marginBottom: `${effectiveGap}px` }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, type: "spring" }}
                        >
                            <div
                                data-photo-id={photo.id}
                                className={`relative rounded-sm overflow-hidden bg-neutral-100 transition-all duration-300 ease-out cursor-pointer hover:shadow-xl hover:shadow-neutral-900/10 hover:-translate-y-1 hover:brightness-[1.02] ${isSelectMode && selectedPhotos.has(photo.id) ? 'ring-4 ring-brand-500 ring-offset-2' : ''}`}
                                onClick={(e) => {
                                    if (isSelectMode) {
                                        // Toggle selection on click
                                        // On mobile (touch), always toggle; on desktop, only toggle for keyboard clicks
                                        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                                        if (isTouchDevice || (!isDragSelecting && e.detail === 0)) {
                                            togglePhotoSelection(photo.id);
                                        }
                                    } else {
                                        setSelectedPhotoIndex(allPhotos.findIndex(p => p.id === photo.id));
                                    }
                                }}
                                onMouseDown={(e) => {
                                    if (e.button !== 0) return; // Left click only
                                    if (isSelectMode) {
                                        e.preventDefault();
                                        handleSelectionMouseDown(photo.id);
                                    } else {
                                        // Start long press timer
                                        longPressTimerRef.current = setTimeout(() => {
                                            setIsSelectMode(true);
                                            // Force start dragging with this item selected
                                            handleSelectionMouseDown(photo.id, true);
                                        }, 1000);
                                    }
                                }}
                                onMouseUp={() => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = null;
                                    }
                                }}
                                onMouseLeave={() => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = null;
                                    }
                                }}
                                onMouseEnter={() => handleSelectionMouseEnter(photo.id)}
                                onContextMenu={(e) => handleContextMenu(e, photo)}
                                // Touch events for mobile
                                onTouchStart={(e) => {
                                    // Clear any existing timer
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                    }
                                    if (isSelectMode) {
                                        // In select mode, start drag selecting immediately
                                        handleSelectionMouseDown(photo.id);
                                    } else {
                                        // Start long press timer to enter select mode
                                        longPressTimerRef.current = setTimeout(() => {
                                            setIsSelectMode(true);
                                            handleSelectionMouseDown(photo.id, true);
                                        }, 500); // 500ms for touch long press
                                    }
                                }}
                                onTouchEnd={() => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = null;
                                    }
                                }}
                                onTouchCancel={() => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = null;
                                    }
                                }}
                            >
                                <img
                                    src={`/api/v1/thumb?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`}
                                    alt={photo.name}
                                    loading="lazy"
                                    draggable="false"
                                    className={`w-full h-auto block select-none transition-opacity ${isSelectMode && selectedPhotos.has(photo.id) ? 'opacity-80' : ''}`}
                                />
                                <AnimatePresence>
                                    {isSelectMode && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            transition={{ duration: 0.2 }}
                                            className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${selectedPhotos.has(photo.id) ? 'bg-brand-500 border-brand-500' : 'bg-white border-neutral-300'}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ))}
                </Masonry>
            ) : (
                /* Grid View */
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {displayPhotos.map((photo) => (
                        <motion.div
                            key={photo.id}
                            className="group"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div
                                data-photo-id={photo.id}
                                className={`relative w-full h-[200px] rounded-sm overflow-hidden bg-neutral-100 transition-all duration-300 ease-out cursor-pointer hover:shadow-xl hover:shadow-neutral-900/10 hover:brightness-[1.02] ${isSelectMode && selectedPhotos.has(photo.id) ? 'ring-4 ring-brand-500 ring-offset-2' : ''}`}
                                onClick={(e) => {
                                    if (isSelectMode) {
                                        // Toggle selection on click
                                        // On mobile (touch), always toggle; on desktop, only toggle for keyboard clicks
                                        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                                        if (isTouchDevice || (!isDragSelecting && e.detail === 0)) {
                                            togglePhotoSelection(photo.id);
                                        }
                                    } else {
                                        setSelectedPhotoIndex(allPhotos.findIndex(p => p.id === photo.id));
                                    }
                                }}
                                onMouseDown={(e) => {
                                    if (e.button !== 0) return; // Left click only
                                    if (isSelectMode) {
                                        e.preventDefault();
                                        handleSelectionMouseDown(photo.id);
                                    } else {
                                        // Start long press timer
                                        longPressTimerRef.current = setTimeout(() => {
                                            setIsSelectMode(true);
                                            // Force start dragging with this item selected
                                            handleSelectionMouseDown(photo.id, true);
                                        }, 1000);
                                    }
                                }}
                                onMouseUp={() => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = null;
                                    }
                                }}
                                onMouseLeave={() => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = null;
                                    }
                                }}
                                onMouseEnter={() => handleSelectionMouseEnter(photo.id)}
                                onContextMenu={(e) => handleContextMenu(e, photo)}
                                // Touch events for mobile
                                onTouchStart={(e) => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                    }
                                    if (isSelectMode) {
                                        handleSelectionMouseDown(photo.id);
                                    } else {
                                        longPressTimerRef.current = setTimeout(() => {
                                            setIsSelectMode(true);
                                            handleSelectionMouseDown(photo.id, true);
                                        }, 500);
                                    }
                                }}
                                onTouchEnd={() => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = null;
                                    }
                                }}
                                onTouchCancel={() => {
                                    if (longPressTimerRef.current) {
                                        clearTimeout(longPressTimerRef.current);
                                        longPressTimerRef.current = null;
                                    }
                                }}
                            >
                                <img
                                    src={`/api/v1/thumb?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`}
                                    alt={photo.name}
                                    loading="lazy"
                                    draggable="false"
                                    className={`w-full h-full object-contain select-none transition-opacity ${isSelectMode && selectedPhotos.has(photo.id) ? 'opacity-80' : ''}`}
                                />
                                <AnimatePresence>
                                    {isSelectMode && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            transition={{ duration: 0.2 }}
                                            className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${selectedPhotos.has(photo.id) ? 'bg-brand-500 border-brand-500' : 'bg-white border-neutral-300'}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Pagination for Grid View */}
            {viewMode === 'grid' && allPhotos.length > 0 && (
                <div className="mt-12 flex items-center justify-center gap-4 pb-8">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm rounded-full bg-white border border-neutral-200 text-neutral-600 hover:border-brand-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        上一页
                    </button>
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <input
                            type="number"
                            min="1"
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setCurrentPage(Math.min(Math.max(1, val), totalPages));
                            }}
                            className="w-12 px-2 py-1 text-center border border-neutral-200 rounded-lg focus:outline-none focus:border-brand-400"
                        />
                        <span>/</span>
                        <span>{totalPages}</span>
                    </div>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm rounded-full bg-white border border-neutral-200 text-neutral-600 hover:border-brand-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        下一页
                    </button>
                </div>
            )}

            {/* Load More for Masonry View */}
            {viewMode === 'masonry' && hasNextPage && allPhotos.length > 0 && (
                <div className="mt-16 flex justify-center pb-8">
                    <button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="px-10 py-3 bg-white border border-neutral-200 hover:border-brand-300 text-neutral-600 rounded-full text-sm font-semibold tracking-wide transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {isFetchingNextPage ? '加载中...' : '加载更多'}
                    </button>
                </div>
            )}

            {/* Lightbox with AnimatePresence for exit animation */}
            <AnimatePresence>
                {selectedPhotoIndex !== null && (
                    <Lightbox
                        photo={{ ...allPhotos[selectedPhotoIndex], alias }}
                        onClose={handleClose}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        hasNext={selectedPhotoIndex + 1 < allPhotos.length}
                        hasPrev={selectedPhotoIndex > 0}
                    />
                )}
            </AnimatePresence>

            <MoveDialog
                open={showMoveDialog}
                onClose={() => setShowMoveDialog(false)}
                onConfirm={handleConfirmMove}
                currentAlias={alias}
                selectedCount={selectedPhotos.size}
            />

            {/* Global Blocking Overlay & Transfer Indicator */}
            <AnimatePresence>
                {moveMutation.isPending && (
                    <div className="fixed inset-0 z-[100] bg-white/50 cursor-wait">
                        {/* Transfer Indicator - Shows only after delay */}
                        <TransferIndicator />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TransferIndicator() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShow(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-6 right-6 bg-white px-6 py-4 rounded-xl shadow-2xl border-2 border-brand-600 flex items-center gap-4 z-[101]"
        >
            <div className="relative w-5 h-5">
                <div className="absolute inset-0 border-2 border-brand-200 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-brand-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="flex flex-col">
                <span className="font-semibold text-neutral-900">传输中...</span>
                <span className="text-xs text-neutral-500">可能需要一些时间，请耐心等待</span>
            </div>
        </motion.div>
    );
}

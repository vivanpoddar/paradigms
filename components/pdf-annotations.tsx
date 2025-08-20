import * as React from 'react';
import { X, Loader2, Palette, Type, Highlighter, MessageSquare, Trash2 } from 'lucide-react';

interface Annotation {
    id: string;
    user_id: string;
    document_name: string;
    page_number: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    color: string;
    type: 'highlight' | 'note' | 'comment';
    created_at: string;
}

interface AnnotationLayerProps {
    annotations: Annotation[];
    renderPageProps: any;
    setSelectedAnnotations: React.Dispatch<React.SetStateAction<Map<string, { annotation: Annotation; position: { x: number; y: number }; isVisible: boolean; isEditing?: boolean }>>>;
    setFrontAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
    pageWidth: number;
    pageHeight: number;
    isAnnotationMode: boolean;
    onCreateAnnotation?: (x: number, y: number, width: number, height: number, pageNumber: number) => void;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({ 
    annotations, 
    renderPageProps, 
    setSelectedAnnotations, 
    setFrontAnnotationId, 
    pageWidth, 
    pageHeight,
    isAnnotationMode,
    onCreateAnnotation
}) => {
    const [isSelecting, setIsSelecting] = React.useState(false);
    const [selectionStart, setSelectionStart] = React.useState<{ x: number; y: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = React.useState<{ x: number; y: number } | null>(null);

    const pageAnnotations = annotations.filter(
        (annotation) => annotation.page_number === renderPageProps.pageIndex + 1
    );

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isAnnotationMode) return;
        
        // Check if we're clicking on an existing annotation
        const target = e.target as HTMLElement;
        if (target.closest('[data-annotation-id]')) {
            return; // Don't start selection if clicking on an existing annotation
        }
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setIsSelecting(true);
        setSelectionStart({ x, y });
        setSelectionEnd({ x, y });
        e.preventDefault();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isSelecting || !selectionStart) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setSelectionEnd({ x, y });
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!isSelecting || !selectionStart || !selectionEnd) return;
        
        const minX = Math.min(selectionStart.x, selectionEnd.x);
        const minY = Math.min(selectionStart.y, selectionEnd.y);
        const maxX = Math.max(selectionStart.x, selectionEnd.x);
        const maxY = Math.max(selectionStart.y, selectionEnd.y);
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        console.log('Selection coordinates:', { 
            start: selectionStart, 
            end: selectionEnd, 
            final: { minX, minY, width, height },
            pageIndex: renderPageProps.pageIndex,
            renderPageProps: {
                width: renderPageProps.width,
                height: renderPageProps.height,
                pageWidth,
                pageHeight
            }
        });
        
        // Reset selection state first
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
        
        // Only create annotation if selection is large enough
        if (width > 10 && height > 10) {
            console.log('Creating annotation with coordinates...');
            // Use the same coordinate system as bounding boxes
            onCreateAnnotation?.(minX, minY, width, height, renderPageProps.pageIndex + 1);
        } else {
            console.log('Selection too small:', { width, height });
        }
    };

    const handleMouseLeave = () => {
        if (isSelecting) {
            setIsSelecting(false);
            setSelectionStart(null);
            setSelectionEnd(null);
        }
    };

    const getSelectionStyle = () => {
        if (!isSelecting || !selectionStart || !selectionEnd) return {};
        
        const minX = Math.min(selectionStart.x, selectionEnd.x);
        const minY = Math.min(selectionStart.y, selectionEnd.y);
        const maxX = Math.max(selectionStart.x, selectionEnd.x);
        const maxY = Math.max(selectionStart.y, selectionEnd.y);
        
        return {
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    };

    return (
        <div
            className={`absolute inset-0 ${isAnnotationMode ? 'cursor-crosshair' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ zIndex: 999 }}
        >
            {/* Existing annotations */}
            {pageAnnotations.map((annotation) => (
                <div
                    key={annotation.id}
                    data-annotation-id={annotation.id}
                    className={`absolute pointer-events-auto cursor-pointer transition-all duration-200 hover:opacity-80 ${
                        annotation.type === 'highlight' 
                            ? 'border-2' 
                            : annotation.type === 'note'
                            ? 'border-2 border-dashed bg-white/90'
                            : 'border-2 border-dotted bg-blue-50/90'
                    }`}
                    style={{
                        left: `${(annotation.x / renderPageProps.width) * 100}%`,
                        top: `${(annotation.y / renderPageProps.height) * 100}%`,
                        width: `${(annotation.width / renderPageProps.width) * 100}%`,
                        height: `${(annotation.height / renderPageProps.height) * 100}%`,
                        backgroundColor: annotation.type === 'highlight' 
                            ? annotation.color + '20'
                            : annotation.type === 'note'
                            ? 'white'
                            : '#dbeafe',
                        borderColor: annotation.color,
                        zIndex: 1000,
                    }}
                    title={annotation.text || `${annotation.type} annotation`}
                    onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const position = {
                            x: rect.right + 10,
                            y: rect.top + rect.height / 2
                        };
                        setSelectedAnnotations(prev => {
                            const newMap = new Map(prev);
                            newMap.set(annotation.id, {
                                annotation,
                                position,
                                isVisible: false
                            });
                            return newMap;
                        });
                        setFrontAnnotationId(annotation.id);
                        setTimeout(() => {
                            setSelectedAnnotations(prev => {
                                const newMap = new Map(prev);
                                const tooltip = newMap.get(annotation.id);
                                if (tooltip) {
                                    newMap.set(annotation.id, { ...tooltip, isVisible: true });
                                }
                                return newMap;
                            });
                        }, 10);
                    }}
                >
                    {/* Annotation type indicator */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: annotation.color }}>
                        {annotation.type === 'highlight' && <Highlighter className="w-2 h-2 text-white" />}
                        {annotation.type === 'note' && <Type className="w-2 h-2 text-white" />}
                        {annotation.type === 'comment' && <MessageSquare className="w-2 h-2 text-white" />}
                    </div>
                    
                    {/* Show text content for note and comment annotations */}
                    {(annotation.type === 'note' || annotation.type === 'comment') && annotation.text && (
                        <div className="p-1 text-xs text-gray-800 overflow-hidden">
                            {annotation.text.substring(0, 50)}{annotation.text.length > 50 ? '...' : ''}
                        </div>
                    )}
                </div>
            ))}
            
            {/* Selection box while creating annotation */}
            {isSelecting && selectionStart && selectionEnd && (
                <div
                    className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
                    style={{
                        ...getSelectionStyle(),
                        zIndex: 1001,
                    }}
                />
            )}
        </div>
    );
};

interface AnnotationTooltipLayerProps {
    selectedAnnotations: Map<string, { annotation: Annotation; position: { x: number; y: number }; isVisible: boolean; isEditing?: boolean }>;
    setSelectedAnnotations: React.Dispatch<React.SetStateAction<Map<string, { annotation: Annotation; position: { x: number; y: number }; isVisible: boolean; isEditing?: boolean }>>>;
    frontAnnotationId: string | null;
    setFrontAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
    userId?: string;
    documentName?: string;
    onAnnotationDeleted?: (annotationId: string) => void;
    onAnnotationUpdated?: (annotation: Annotation) => void;
}

export const AnnotationTooltipLayer: React.FC<AnnotationTooltipLayerProps> = ({
    selectedAnnotations,
    setSelectedAnnotations,
    frontAnnotationId,
    setFrontAnnotationId,
    userId,
    documentName,
    onAnnotationDeleted,
    onAnnotationUpdated
}) => {
    const [editingText, setEditingText] = React.useState<string>('');
    const [editingColor, setEditingColor] = React.useState<string>('#fbbf24');

    const colors = [
        '#fbbf24', // Yellow
        '#f87171', // Red
        '#60a5fa', // Blue
        '#34d399', // Green
        '#a78bfa', // Purple
    ];

    const handleCloseTooltip = (annotationId: string) => {
        setSelectedAnnotations(prev => {
            const newMap = new Map(prev);
            newMap.delete(annotationId);
            return newMap;
        });
        if (frontAnnotationId === annotationId) {
            setFrontAnnotationId(null);
        }
    };

    const handleEditAnnotation = (annotationId: string) => {
        const annotation = selectedAnnotations.get(annotationId)?.annotation;
        if (!annotation) return;
        
        setEditingText(annotation.text || '');
        setEditingColor(annotation.color);
        
        setSelectedAnnotations(prev => {
            const newMap = new Map(prev);
            const tooltip = newMap.get(annotationId);
            if (tooltip) {
                newMap.set(annotationId, { ...tooltip, isEditing: true });
            }
            return newMap;
        });
    };

    const handleSaveEdit = async (annotationId: string) => {
        // Optimistic update - update UI immediately
        const currentAnnotation = selectedAnnotations.get(annotationId)?.annotation;
        if (!currentAnnotation) return;
        
        const optimisticUpdate = {
            ...currentAnnotation,
            text: editingText,
            color: editingColor,
            updated_at: new Date().toISOString()
        };
        
        // Update UI immediately
        onAnnotationUpdated?.(optimisticUpdate);
        setSelectedAnnotations(prev => {
            const newMap = new Map(prev);
            const tooltip = newMap.get(annotationId);
            if (tooltip) {
                newMap.set(annotationId, { 
                    ...tooltip, 
                    annotation: optimisticUpdate,
                    isEditing: false 
                });
            }
            return newMap;
        });
        
        // Perform server update asynchronously
        try {
            const response = await fetch(`/api/annotations?id=${annotationId}&userId=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: editingText,
                    color: editingColor,
                }),
            });

            if (response.ok) {
                const serverAnnotation = await response.json();
                // Update with server response (in case there are differences)
                onAnnotationUpdated?.(serverAnnotation);
                setSelectedAnnotations(prev => {
                    const newMap = new Map(prev);
                    const tooltip = newMap.get(annotationId);
                    if (tooltip) {
                        newMap.set(annotationId, { 
                            ...tooltip, 
                            annotation: serverAnnotation
                        });
                    }
                    return newMap;
                });
            } else {
                // If update failed, revert to original
                onAnnotationUpdated?.(currentAnnotation);
                console.error('Failed to update annotation on server');
            }
        } catch (error) {
            // If network error, revert to original
            onAnnotationUpdated?.(currentAnnotation);
            console.error('Error updating annotation:', error);
        }
    };

    const handleQuickSave = async (annotationId: string, text: string, color: string) => {
        // Optimistic update - update UI immediately
        const currentAnnotation = selectedAnnotations.get(annotationId)?.annotation;
        if (!currentAnnotation) return;
        
        const optimisticUpdate = {
            ...currentAnnotation,
            text,
            color,
            updated_at: new Date().toISOString()
        };
        
        // Update UI immediately
        onAnnotationUpdated?.(optimisticUpdate);
        setSelectedAnnotations(prev => {
            const newMap = new Map(prev);
            const tooltip = newMap.get(annotationId);
            if (tooltip) {
                newMap.set(annotationId, { 
                    ...tooltip, 
                    annotation: optimisticUpdate
                });
            }
            return newMap;
        });
        
        // Perform server update asynchronously
        try {
            const response = await fetch(`/api/annotations?id=${annotationId}&userId=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    color,
                }),
            });

            if (response.ok) {
                const serverAnnotation = await response.json();
                // Update with server response
                onAnnotationUpdated?.(serverAnnotation);
                setSelectedAnnotations(prev => {
                    const newMap = new Map(prev);
                    const tooltip = newMap.get(annotationId);
                    if (tooltip) {
                        newMap.set(annotationId, { 
                            ...tooltip, 
                            annotation: serverAnnotation
                        });
                    }
                    return newMap;
                });
            } else {
                // If update failed, revert to original
                onAnnotationUpdated?.(currentAnnotation);
                console.error('Failed to update annotation on server');
            }
        } catch (error) {
            // If network error, revert to original
            onAnnotationUpdated?.(currentAnnotation);
            console.error('Error updating annotation:', error);
        }
    };

    const handleDeleteAnnotation = async (annotationId: string) => {
        // Optimistic update - remove immediately from UI
        onAnnotationDeleted?.(annotationId);
        handleCloseTooltip(annotationId);
        
        // Perform deletion asynchronously
        try {
            const response = await fetch(`/api/annotations?id=${annotationId}&userId=${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                // If deletion failed, we would need to restore the annotation
                // For now, just log the error
                console.error('Failed to delete annotation on server');
            }
        } catch (error) {
            console.error('Error deleting annotation:', error);
            // In a production app, you might want to restore the annotation here
        }
    };

    return (
        <>
            {/* Backdrop overlay when any tooltip is open */}
            {selectedAnnotations.size > 0 && (
                <div
                    className={`fixed inset-0 bg-black transition-opacity duration-200 ease-out z-30 pointer-events-none ${
                        Array.from(selectedAnnotations.values()).some(tooltip => tooltip.isVisible) ? 'bg-opacity-20' : 'bg-opacity-0'
                    }`}
                />
            )}

            {/* Render all active tooltips */}
            {Array.from(selectedAnnotations.entries()).map(([annotationId, { annotation, position, isVisible, isEditing }]) => (
                <div
                    key={annotationId}
                    className={`fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4 max-w-sm pointer-events-auto transition-all duration-200 ease-out cursor-pointer ${
                        isVisible 
                            ? 'opacity-100 scale-100 translate-y-0' 
                            : 'opacity-0 scale-95 translate-y-2'
                    }`}
                    style={{
                        left: Math.min(position.x, window.innerWidth - 384),
                        top: Math.max(16, Math.min(position.y - 100, window.innerHeight - 200)),
                        transform: `translate(0, 0) ${!isVisible ? 'translateX(-8px) scale(0.95)' : ''}`,
                        zIndex: frontAnnotationId === annotationId ? 50 : 40,
                    }}
                    onClick={() => setFrontAnnotationId(annotationId)}
                >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: annotation.color }}
                                />
                                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                    {annotation.type}
                                </span>
                            </div>
                            <button
                                onClick={() => handleCloseTooltip(annotationId)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Text content - always editable */}
                            {(annotation.type === 'note' || annotation.type === 'comment') && (
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Text:</label>
                                    <textarea
                                        value={isEditing ? editingText : annotation.text || ''}
                                        onChange={(e) => {
                                            if (isEditing) {
                                                setEditingText(e.target.value);
                                            } else {
                                                // Auto-save mode - update directly
                                                handleQuickSave(annotationId, e.target.value, annotation.color);
                                            }
                                        }}
                                        onFocus={() => {
                                            if (!isEditing) {
                                                setEditingText(annotation.text || '');
                                                setEditingColor(annotation.color);
                                                handleEditAnnotation(annotationId);
                                            }
                                        }}
                                        placeholder="Add text..."
                                        className="w-full p-2 border rounded resize-none text-sm dark:bg-gray-700 dark:border-gray-600"
                                        rows={2}
                                    />
                                </div>
                            )}

                            {/* Color picker - always visible */}
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Color:</label>
                                <div className="flex gap-1">
                                    {colors.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                if (isEditing) {
                                                    setEditingColor(color);
                                                } else {
                                                    handleQuickSave(annotationId, annotation.text || '', color);
                                                }
                                            }}
                                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                                                (isEditing ? editingColor : annotation.color) === color
                                                    ? 'border-gray-800 dark:border-white scale-110'
                                                    : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(annotation.created_at).toLocaleDateString()}
                                </div>
                                
                                <div className="flex gap-2">
                                    {isEditing && (
                                        <>
                                            <button
                                                onClick={() => handleSaveEdit(annotationId)}
                                                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setSelectedAnnotations(prev => {
                                                    const newMap = new Map(prev);
                                                    const tooltip = newMap.get(annotationId);
                                                    if (tooltip) {
                                                        newMap.set(annotationId, { ...tooltip, isEditing: false });
                                                    }
                                                    return newMap;
                                                })}
                                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => handleDeleteAnnotation(annotationId)}
                                        className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800 transition-colors flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
            ))}
        </>
    );
};

import * as React from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { X, Loader2, MessageCircle } from 'lucide-react';

interface BoundingBox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    pageNumber: number;
}

interface PdfBoundingBoxesProps {
    apiBoundingBoxes: BoundingBox[];
    renderPageProps: any;
    setSelectedBoxes: React.Dispatch<React.SetStateAction<Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean; solution?: string; isLoading?: boolean }>>>;
    setFrontTooltipId: React.Dispatch<React.SetStateAction<string | null>>;
    pageWidth: number;
    pageHeight: number;
}

const BoundingBoxLayer: React.FC<PdfBoundingBoxesProps> = ({ apiBoundingBoxes, renderPageProps, setSelectedBoxes, setFrontTooltipId, pageWidth, pageHeight }) => (
    <div>
        {apiBoundingBoxes
            .filter((box) => box.pageNumber - 1 === renderPageProps.pageIndex)
            .map((box) => (
                <div
                    key={box.id}
                    className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-auto cursor-pointer hover:bg-blue-500/20 transition-colors"
                    style={{
                        position: 'absolute',
                        left: `${(box.x / renderPageProps.width) * 26}%`,
                        top: `${(box.y / renderPageProps.height) * 26}%`,
                        width: `${(box.width / renderPageProps.width) * 26}%`,
                        height: `${(box.height / renderPageProps.height) * 26}%`,
                        zIndex: 1000,
                    }}
                    title={box.text}
                    onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const position = {
                            x: rect.right + 10,
                            y: rect.top + rect.height / 2
                        };
                        setSelectedBoxes(prev => {
                            const newMap = new Map(prev);
                            newMap.set(box.id, {
                                box,
                                position,
                                isVisible: false
                            });
                            return newMap;
                        });
                        setFrontTooltipId(box.id);
                        setTimeout(() => {
                            setSelectedBoxes(prev => {
                                const newMap = new Map(prev);
                                const tooltip = newMap.get(box.id);
                                if (tooltip) {
                                    newMap.set(box.id, { ...tooltip, isVisible: true });
                                }
                                return newMap;
                            });
                        }, 10);
                    }}
                >
                    {/* Render LaTeX preview on hover or always, as desired */}
                    <div className="absolute left-0 top-full mt-2 bg-white border border-gray-300 rounded shadow-lg p-2 z-50 min-w-[120px] max-w-xs text-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        {/\$.*\$/.test(box.text) ? (
                            <InlineMath math={box.text.replace(/\$/g, '')} />
                        ) : (
                            <span>{box.text}</span>
                        )}
                    </div>
                </div>
            ))}
    </div>
);

interface TooltipLayerProps {
    selectedBoxes: Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean; solution?: string; isLoading?: boolean }>;
    setSelectedBoxes: React.Dispatch<React.SetStateAction<Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean; solution?: string; isLoading?: boolean }>>>;
    frontTooltipId: string | null;
    setFrontTooltipId: React.Dispatch<React.SetStateAction<string | null>>;
    selectedFileName?: string | null;
    onExplain?: (problemText: string, solution: string) => void;
    preloadedAnswers?: Map<string, string>;
    onAnswerSaved?: (tooltipId: string, answer: string) => void;
}

export const TooltipLayer: React.FC<TooltipLayerProps> = ({ selectedBoxes, setSelectedBoxes, frontTooltipId, setFrontTooltipId, selectedFileName, onExplain, preloadedAnswers, onAnswerSaved }) => {
    // Track which tooltips have their action menu expanded
    const [expandedMenus, setExpandedMenus] = React.useState<Set<string>>(new Set());
    
    // Auto-expand menu for newly opened tooltips with animation delay
    React.useEffect(() => {
        const visibleTooltips = Array.from(selectedBoxes.entries())
            .filter(([_, tooltip]) => tooltip.isVisible)
            .map(([boxId, _]) => boxId);
        
        if (visibleTooltips.length > 0) {
            // Add a slight delay to let the tooltip appear first, then expand the menu
            setTimeout(() => {
                setExpandedMenus(prev => {
                    const newSet = new Set(prev);
                    visibleTooltips.forEach(boxId => newSet.add(boxId));
                    return newSet;
                });
            }, 300); // Delay to let tooltip animate in first
        }
    }, [selectedBoxes]);
    
    // Clean up expanded menus for closed tooltips
    React.useEffect(() => {
        const visibleBoxIds = new Set(
            Array.from(selectedBoxes.entries())
                .filter(([_, tooltip]) => tooltip.isVisible)
                .map(([boxId, _]) => boxId)
        );
        
        setExpandedMenus(prev => {
            const newSet = new Set<string>();
            prev.forEach(boxId => {
                if (visibleBoxIds.has(boxId)) {
                    newSet.add(boxId);
                }
            });
            return newSet;
        });
    }, [selectedBoxes]);
    
    // Apply preloaded answers when tooltips become visible
    React.useEffect(() => {
        if (!preloadedAnswers || preloadedAnswers.size === 0) return;
        
        const visibleBoxes = Array.from(selectedBoxes.entries()).filter(
            ([_, tooltip]) => tooltip.isVisible && !tooltip.solution
        );
        
        visibleBoxes.forEach(([boxId, _]) => {
            const preloadedAnswer = preloadedAnswers.get(boxId);
            if (preloadedAnswer) {
                setSelectedBoxes(prev => {
                    const newMap = new Map(prev);
                    const currentTooltip = newMap.get(boxId);
                    if (currentTooltip && !currentTooltip.solution) { // Only if no solution exists
                        newMap.set(boxId, { ...currentTooltip, solution: preloadedAnswer });
                    }
                    return newMap;
                });
            }
        });
    }, [selectedBoxes, preloadedAnswers, setSelectedBoxes]);

    // Check for existing answer when tooltip is opened
    const checkExistingAnswer = async (boxId: string) => {
        if (!selectedFileName) return;
        
        try {
            const response = await fetch(`/api/document-answers?fileName=${encodeURIComponent(selectedFileName)}&tooltipId=${encodeURIComponent(boxId)}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.answers && data.answers.length > 0) {
                    const latestAnswer = data.answers[0]; // Most recent answer
                    
                    // Update tooltip with existing solution
                    setSelectedBoxes(prev => {
                        const newMap = new Map(prev);
                        const currentTooltip = newMap.get(boxId);
                        if (currentTooltip) {
                            newMap.set(boxId, { ...currentTooltip, solution: latestAnswer.response });
                        }
                        return newMap;
                    });
                }
            }
        } catch (error) {
            console.error('Failed to check existing answer:', error);
        }
    };

    const handleSolve = async (boxId: string, problemText: string) => {
        // Clear any existing solution first
        setSelectedBoxes(prev => {
            const newMap = new Map(prev);
            const currentTooltip = newMap.get(boxId);
            if (currentTooltip) {
                newMap.set(boxId, { ...currentTooltip, solution: undefined, isLoading: true });
            }
            return newMap;
        });

        try {
            const response = await fetch('/api/solve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    query: `You are a high school teacher creating an answer key for a document. 
                    Your task is to solve the following question. 
                    If your answer includes math, clearly format all math expressions in LaTeX using $ symbols. 
                    Only provide the final answer—do not include explanations or steps.                   
                    ${problemText}`, 
                    fileName: selectedFileName,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let fullResponse = '';
            
            // Handle streaming response
            const reader = response.body?.getReader();
            if (reader) {
                const decoder = new TextDecoder();
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            
                            if (data.error) {
                                throw new Error(data.error);
                            }
                            
                            if (data.content) {
                                fullResponse += data.content;
                                // Update the solution in real-time
                                setSelectedBoxes(prev => {
                                    const newMap = new Map(prev);
                                    const currentTooltip = newMap.get(boxId);
                                    if (currentTooltip) {
                                        newMap.set(boxId, { ...currentTooltip, solution: fullResponse, isLoading: true });
                                    }
                                    return newMap;
                                });
                            }
                            
                            if (data.done) {
                                break;
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse streaming chunk:', parseError);
                        }
                    }
                    
                    // Check if we received a done signal to break the outer loop
                    if (lines.some(line => {
                        try {
                            const data = JSON.parse(line);
                            return data.done;
                        } catch {
                            return false;
                        }
                    })) {
                        break;
                    }
                }
            } else {
                // Fallback for non-streaming response
                const data = await response.json();
                fullResponse = data.response;
            }

            // Set final solution and clear loading
            setSelectedBoxes(prev => {
                const newMap = new Map(prev);
                const currentTooltip = newMap.get(boxId);
                if (currentTooltip) {
                    newMap.set(boxId, { ...currentTooltip, solution: fullResponse, isLoading: false });
                }
                return newMap;
            });

            // Save answer to database
            try {
                await fetch('/api/document-answers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fileName: selectedFileName,
                        response: fullResponse,
                        tooltipId: boxId,
                        metadata: {
                            problemText: problemText,
                            timestamp: new Date().toISOString(),
                            source: 'tooltip'
                        }
                    }),
                });
                
                // Update preloaded answers cache with the new answer
                if (onAnswerSaved) {
                    onAnswerSaved(boxId, fullResponse);
                }
            } catch (saveError) {
                console.error('Failed to save answer to database:', saveError);
                // Don't throw here as the main functionality (showing solution) should still work
            }

        } catch (error) {
            console.error('Error solving problem:', error);
            const errorMessage = 'Sorry, I encountered an error while solving this problem. Please try again.';
            
            setSelectedBoxes(prev => {
                const newMap = new Map(prev);
                const currentTooltip = newMap.get(boxId);
                if (currentTooltip) {
                    newMap.set(boxId, { ...currentTooltip, solution: errorMessage, isLoading: false });
                }
                return newMap;
            });
        }
    };

    return (
    <>
        {/* Backdrop overlay when any tooltip is open */}
        {selectedBoxes.size > 0 && (
            <div
                className={`fixed inset-0 bg-black transition-opacity duration-200 ease-out z-40 pointer-events-none ${
                    Array.from(selectedBoxes.values()).some(tooltip => tooltip.isVisible) ? 'bg-opacity-20' : 'bg-opacity-0'
                }`}
            />
        )}

        {/* Render all active tooltips */}
        {Array.from(selectedBoxes.entries()).map(([boxId, tooltip]) => (
            <div
                id="tooltip"
                key={boxId}
                className={`fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 max-w-md pointer-events-auto transition-all duration-200 ease-out cursor-pointer ${
                    tooltip.isVisible 
                        ? 'opacity-100 scale-100 translate-y-0' 
                        : 'opacity-0 scale-95 translate-y-2'
                }`}
                style={{
                    left: `${tooltip.position.x}px`,
                    top: `${tooltip.position.y}px`,
                    transform: `translate(0, -50%) ${!tooltip.isVisible ? 'translateX(-8px) scale(0.95)' : ''}`,
                    position: 'fixed',
                    zIndex: frontTooltipId === boxId ? 60 : 50, // Higher z-index for front tooltip
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setFrontTooltipId(boxId); // Bring this tooltip to front when clicked
                }}
            >
                <div className="flex justify-between items-start">
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
                        <div className="mb-2">
                            {tooltip.box.text.split(/(\$[^$]+\$)/g).map((part, i) =>
                                part.startsWith('$') && part.endsWith('$')
                                    ? <InlineMath key={i} math={part.slice(1, -1)} />
                                    : <span key={i}>{part}</span>
                            )}
                        </div>
                        {tooltip.solution && (
                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border-t">
                                <div className="text-xs whitespace-pre-wrap">                            
                                    {tooltip.solution.split(/(\$[^$]+\$)/g).map((part, i) =>
                                    part.startsWith('$') && part.endsWith('$')
                                        ? <InlineMath key={i} math={part.slice(1, -1)} />
                                        : <span key={i}>{part}</span>
                                )}</div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            // Close this specific tooltip
                            setSelectedBoxes(prev => {
                                const newMap = new Map(prev);
                                const currentTooltip = newMap.get(boxId);
                                if (currentTooltip) {
                                    newMap.set(boxId, { ...currentTooltip, isVisible: false });
                                }
                                return newMap;
                            });
                            
                            // Clear front tooltip if this was the front one
                            if (frontTooltipId === boxId) {
                                setFrontTooltipId(null);
                            }
                            
                            setTimeout(() => {
                                setSelectedBoxes(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(boxId);
                                    return newMap;
                                });
                            }, 150);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2 p-1 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
                
                {/* Action Menu Toggle */}
                <div className="mt-2 border-t border-gray-200 dark:border-gray-600 pt-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpandedMenus(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(boxId)) {
                                    newSet.delete(boxId);
                                } else {
                                    newSet.add(boxId);
                                }
                                return newSet;
                            });
                        }}
                        className="w-full flex items-center justify-between px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                        <span className="font-medium">Actions</span>
                        <div className={`transform transition-transform duration-200 text-xs ${expandedMenus.has(boxId) ? 'rotate-180' : ''}`}>
                            ▼
                        </div>
                    </button>
                    
                    {/* Animated Action Menu */}
                    <div
                        className={`overflow-hidden transition-all duration-300 ease-out ${
                            expandedMenus.has(boxId) 
                                ? 'max-h-20 opacity-100 mt-2' 
                                : 'max-h-0 opacity-0'
                        }`}
                    >
                        <div className="flex gap-2">
                            <button
                                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSolve(boxId, tooltip.box.text);
                                }}
                                disabled={tooltip.isLoading}
                            >
                                {tooltip.isLoading ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Solving...
                                    </>
                                ) : (
                                    tooltip.solution ? 'Solve Again' : 'Solve'
                                )}
                            </button>
                            {tooltip.solution && !tooltip.isLoading && onExplain && (
                                <button
                                    className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors flex items-center gap-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (tooltip.solution) {
                                            onExplain(tooltip.box.text, tooltip.solution);
                                        }
                                    }}
                                >
                                    <MessageCircle className="w-3 h-3" />
                                    Explain
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        ))}
    </>
    );
};

export { BoundingBoxLayer };

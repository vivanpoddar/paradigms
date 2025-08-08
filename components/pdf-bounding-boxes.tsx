import * as React from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { X } from 'lucide-react';

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
    setSelectedBoxes: React.Dispatch<React.SetStateAction<Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean }>>>;
    setFrontTooltipId: React.Dispatch<React.SetStateAction<string | null>>;
}

const BoundingBoxLayer: React.FC<PdfBoundingBoxesProps> = ({ apiBoundingBoxes, renderPageProps, setSelectedBoxes, setFrontTooltipId }) => (
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
    selectedBoxes: Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean }>;
    setSelectedBoxes: React.Dispatch<React.SetStateAction<Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean }>>>;
    frontTooltipId: string | null;
    setFrontTooltipId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const TooltipLayer: React.FC<TooltipLayerProps> = ({ selectedBoxes, setSelectedBoxes, frontTooltipId, setFrontTooltipId }) => (
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
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        {tooltip.box.text.split(/(\$[^$]+\$)/g).map((part, i) =>
                            part.startsWith('$') && part.endsWith('$')
                                ? <InlineMath key={i} math={part.slice(1, -1)} />
                                : <span key={i}>{part}</span>
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
            </div>
        ))}
    </>
);

export { BoundingBoxLayer };

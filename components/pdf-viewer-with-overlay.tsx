'use client';

import * as React from 'react';
import { Worker } from '@react-pdf-viewer/core';
import { Viewer } from '@react-pdf-viewer/core';
import { RenderGoToPageProps } from '@react-pdf-viewer/page-navigation';
import { toolbarPlugin, ToolbarSlot } from '@react-pdf-viewer/toolbar';
import { RenderCurrentScaleProps, RenderZoomInProps, RenderZoomOutProps } from '@react-pdf-viewer/zoom';
import { searchPlugin } from '@react-pdf-viewer/search';
import { getFilePlugin } from '@react-pdf-viewer/get-file';
import { fullScreenPlugin } from '@react-pdf-viewer/full-screen';
import { Search, Download, Maximize2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X } from 'lucide-react';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/toolbar/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/full-screen/lib/styles/index.css';


// Types for bounding box data
interface BoundingBox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    pageNumber: number;
}

interface PdfViewerWithOverlayProps {
    pdfUrl: string;
    boundingBoxes?: BoundingBox[];
    className?: string;
}

export const PdfViewerWithOverlay: React.FC<PdfViewerWithOverlayProps> = ({ 
    pdfUrl, 
    boundingBoxes = [], 
    className = "" 
}) => {
    const [apiBoundingBoxes, setApiBoundingBoxes] = React.useState<BoundingBox[]>([]);
    const [selectedBoxes, setSelectedBoxes] = React.useState<Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean }>>(new Map());
    const [frontTooltipId, setFrontTooltipId] = React.useState<string | null>(null);
    const pdfContainerRef = React.useRef<HTMLDivElement>(null);

    // Block PDF scrolling when any tooltip is open
    React.useEffect(() => {
        const hasOpenTooltips = Array.from(selectedBoxes.values()).some(tooltip => tooltip.isVisible);
        
        if (hasOpenTooltips) {
            // Prevent scrolling by blocking wheel and touch events
            const preventScroll = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
            };

            // Find the PDF viewer container and prevent scrolling
            const pdfViewerElement = document.querySelector('.rpv-core__viewer');
            if (pdfViewerElement) {
                pdfViewerElement.addEventListener('wheel', preventScroll, { passive: false });
                pdfViewerElement.addEventListener('touchmove', preventScroll, { passive: false });
                
                return () => {
                    pdfViewerElement.removeEventListener('wheel', preventScroll);
                    pdfViewerElement.removeEventListener('touchmove', preventScroll);
                };
            }
        }
    }, [selectedBoxes]);

    // Note: Removed general click handler to allow multiple tooltip interaction

    // Fetch bounding boxes from API
    React.useEffect(() => {
        const fetchBoundingBoxes = async () => {
            try {
                const response = await fetch('/api/bounding-boxes');
                if (response.ok) {
                    const data = await response.json();
                    console.log('Fetched bounding boxes:', data);
                    setApiBoundingBoxes(data);
                } else {
                    console.error('Failed to fetch bounding boxes');
                }
            } catch (error) {
                console.error('Error fetching bounding boxes:', error);
            }
        };

        fetchBoundingBoxes();
    }, []);

    const searchPluginInstance = searchPlugin();
    const getFilePluginInstance = getFilePlugin();
    const fullScreenPluginInstance = fullScreenPlugin();
    
    // Create a custom plugin to render bounding boxes on each page
    const boundingBoxPlugin = () => ({
        renderPageLayer: (renderPageProps: any) => (
            <div>
                {/* Render bounding boxes for this specific page */}
                {apiBoundingBoxes
                    .filter((box) => box.pageNumber - 1 === renderPageProps.pageIndex)
                    .map((box) => (
                        <div
                            key={box.id}
                            className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-auto cursor-pointer hover:bg-blue-500/20 transition-colors"
                            style={{
                                position: 'absolute',
                                left: `${(box.x / 595) * 100}%`, // Use actual PDF coordinates
                                top: `${(box.y / 842) * 100}%`,
                                width: `${(box.width / 595) * 100}%`,
                                height: `${(box.height / 842) * 100}%`,
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
                                
                                // Add new tooltip to the map
                                setSelectedBoxes(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(box.id, {
                                        box,
                                        position,
                                        isVisible: false
                                    });
                                    return newMap;
                                });
                                
                                // Set this tooltip as the front tooltip
                                setFrontTooltipId(box.id);
                                
                                // Make tooltip visible after a brief delay for smooth transition
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
                        />
                    ))}
            </div>
        ),
    });
    
    const boundingBoxPluginInstance = boundingBoxPlugin();
    
    const toolbarPluginInstance = toolbarPlugin();
    const { Toolbar } = toolbarPluginInstance;
    const { Download: DownloadComponent } = getFilePluginInstance;
    const { EnterFullScreen } = fullScreenPluginInstance;

    return (
        <div className={`relative ${className}`}>
            <Worker workerUrl='https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js'>
                <div
                    className="bg-white dark:bg-black"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '91vh',
                    }}

                >
                    <div className="flex items-center justify-between px-4">
                        <Toolbar>
                            {(props: ToolbarSlot) => {
                                const {
                                    CurrentPageInput,
                                    CurrentScale,
                                    GoToNextPage,
                                    GoToPreviousPage,
                                    NumberOfPages,
                                    ShowSearchPopover,
                                    ZoomIn: ZoomInComponent,
                                    ZoomOut: ZoomOutComponent,
                                } = props;
                                return (
                                    <div className="flex items-center gap-2 w-full">
                                        {/* Left side - Search and Zoom controls */}
                                        <div className="flex items-center gap-2">
                                            <ShowSearchPopover>
                                                {(props) => (
                                                    <button 
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                                                        onClick={props.onClick}
                                                        title="Search"
                                                    >
                                                        <Search className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                    </button>
                                                )}
                                            </ShowSearchPopover>
                                            
                                            <div className="flex items-center bg-white dark:bg-black rounded-sm border border-zinc-200 dark:border-zinc-800">
                                                <ZoomOutComponent>
                                                    {(props: RenderZoomOutProps) => (
                                                        <button
                                                            className="p-2"
                                                            onClick={props.onClick}
                                                            title="Zoom out"
                                                        >
                                                            <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                        </button>
                                                    )}
                                                </ZoomOutComponent>
                                                
                                                <div className="px-3 min-w-[60px] text-center">
                                                    <CurrentScale>
                                                        {(props: RenderCurrentScaleProps) => (
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                {`${Math.round(props.scale * 100)}%`}
                                                            </span>
                                                        )}
                                                    </CurrentScale>
                                                </div>
                                                
                                                <ZoomInComponent>
                                                    {(props: RenderZoomInProps) => (
                                                        <button
                                                            className="p-2"
                                                            onClick={props.onClick}
                                                            title="Zoom in"
                                                        >
                                                            <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                        </button>
                                                    )}
                                                </ZoomInComponent>
                                            </div>
                                        </div>

                                        {/* Center - Page navigation */}
                                        <div className="flex items-center gap-2 mx-auto">
                                            <GoToPreviousPage>
                                                {(props: RenderGoToPageProps) => (
                                                    <button
                                                        className={`p-2 rounded-md transition-colors ${
                                                            props.isDisabled 
                                                                ? 'text-gray-400 cursor-not-allowed' 
                                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                        }`}
                                                        disabled={props.isDisabled}
                                                        onClick={props.onClick}
                                                        title="Previous page"
                                                    >
                                                        <ChevronLeft className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </GoToPreviousPage>
                                            
                                            <div className="flex items-center gap-2 bg-white dark:bg-black rounded-sm px-3 my-1">
                                                <div className="w-16 dark:bg-black dark:text-white">
                                                    <CurrentPageInput />
                                                </div>
                                                <span className="text-gray-500 dark:text-gray-400 text-sm">
                                                    / <NumberOfPages />
                                                </span>
                                            </div>
                                            
                                            <GoToNextPage>
                                                {(props: RenderGoToPageProps) => (
                                                    <button
                                                        className={`p-2 rounded-md transition-colors ${
                                                            props.isDisabled 
                                                                ? 'text-gray-400 cursor-not-allowed' 
                                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                        }`}
                                                        disabled={props.isDisabled}
                                                        onClick={props.onClick}
                                                        title="Next page"
                                                    >
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </GoToNextPage>
                                        </div>

                                        {/* Right side - Download and Full screen */}
                                        <div className="flex items-center gap-2">
                                            <DownloadComponent>
                                                {(props) => (
                                                    <button 
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                                                        onClick={props.onClick}
                                                        title="Download"
                                                    >
                                                        <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                    </button>
                                                )}
                                            </DownloadComponent>
                                            
                                            <EnterFullScreen>
                                                {(props) => (
                                                    <button 
                                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                                                        onClick={props.onClick}
                                                        title="Full Screen"
                                                    >
                                                        <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                    </button>
                                                )}
                                            </EnterFullScreen>
                                        </div>
                                    </div>
                                );
                            }}
                        </Toolbar>
                    </div>
                    <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-black" ref={pdfContainerRef}>
                        <Viewer 
                            fileUrl={pdfUrl} 
                            plugins={[
                                toolbarPluginInstance, 
                                searchPluginInstance, 
                                getFilePluginInstance, 
                                fullScreenPluginInstance,
                                boundingBoxPluginInstance
                            ]} 
                        />
                    </div>
                </div>
            </Worker>

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
                    key={boxId}
                    className={`fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 max-w-md pointer-events-auto transition-all duration-200 ease-out cursor-pointer ${
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
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Highlighted Text
                        </h3>
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
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {tooltip.box.text}
                    </div>
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        Page {tooltip.box.pageNumber} • ID: {tooltip.box.id}
                    </div>
                </div>
            ))}
        </div>
    );
};

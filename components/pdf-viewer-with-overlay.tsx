'use client';

import * as React from 'react';
import { Worker } from '@react-pdf-viewer/core';
import { Viewer } from '@react-pdf-viewer/core';
import { RenderGoToPageProps } from '@react-pdf-viewer/page-navigation';
import { toolbarPlugin, ToolbarSlot } from '@react-pdf-viewer/toolbar';
import { searchPlugin } from '@react-pdf-viewer/search';
import { getFilePlugin } from '@react-pdf-viewer/get-file';
import { fullScreenPlugin } from '@react-pdf-viewer/full-screen';
import { Search, Download, Maximize2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { BoundingBoxLayer, TooltipLayer } from './pdf-bounding-boxes';
// Make sure that './pdf-bounding-boxes.tsx' exists and exports BoundingBoxLayer as a named export.

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
    user?: string; // Optional user ID for fetching bounding boxes
    fileName?: string;
}

export const PdfViewerWithOverlay: React.FC<PdfViewerWithOverlayProps> = ({ 
    pdfUrl, 
    user,
    boundingBoxes = [], 
    fileName = "" 
}) => {
    const [apiBoundingBoxes, setApiBoundingBoxes] = React.useState<BoundingBox[]>([]);
    const [selectedBoxes, setSelectedBoxes] = React.useState<Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean; solution?: string; isLoading?: boolean }>>(new Map());
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
                const params = new URLSearchParams();
                if (user) params.append('userId', user);
                if (fileName) {
                    const baseFileName = fileName.replace(/\.[^/.]+$/, '');
                    params.append('filename', baseFileName);
                }
                const response = await fetch(`/api/bounding-boxes?${params.toString()}`);
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
            <BoundingBoxLayer
                apiBoundingBoxes={apiBoundingBoxes}
                renderPageProps={renderPageProps}
                setSelectedBoxes={setSelectedBoxes}
                setFrontTooltipId={setFrontTooltipId}
            />
        ),
    });
    
    const boundingBoxPluginInstance = boundingBoxPlugin();
    
    const toolbarPluginInstance = toolbarPlugin();
    const { Toolbar } = toolbarPluginInstance;
    const { Download: DownloadComponent } = getFilePluginInstance;
    const { EnterFullScreen } = fullScreenPluginInstance;

    return (
        <div>
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
                                    GoToNextPage,
                                    GoToPreviousPage,
                                    NumberOfPages,
                                    ShowSearchPopover,
                                } = props;
                                return (
                                    <div className="flex items-center gap-2 w-full">
                                        {/* Left side - Search controls */}
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
            <TooltipLayer
                selectedBoxes={selectedBoxes}
                setSelectedBoxes={setSelectedBoxes}
                frontTooltipId={frontTooltipId}
                setFrontTooltipId={setFrontTooltipId}
                selectedFileName={fileName}
            />
        </div>
    );
};

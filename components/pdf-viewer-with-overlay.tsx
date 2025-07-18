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
import { Search, Download, Maximize2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { highlightPlugin, HighlightArea } from '@react-pdf-viewer/highlight';

import '@react-pdf-viewer/highlight/lib/styles/index.css';
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
    const searchPluginInstance = searchPlugin();
    const getFilePluginInstance = getFilePlugin();
    const fullScreenPluginInstance = fullScreenPlugin();
    const highlightPluginInstance = highlightPlugin();
    
    const toolbarPluginInstance = toolbarPlugin();
    const { Toolbar } = toolbarPluginInstance;
    const { Search: SearchComponent } = searchPluginInstance;
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
                    <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-black">
                        <Viewer 
                            fileUrl={pdfUrl} 
                            plugins={[
                                toolbarPluginInstance, 
                                searchPluginInstance, 
                                getFilePluginInstance, 
                                fullScreenPluginInstance,
                                highlightPluginInstance
                            ]} 
                        />
                    </div>
                </div>
            </Worker>

            {/* Bounding boxes overlay */}
            {boundingBoxes.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                    {boundingBoxes.map((box) => (
                        <div
                            key={box.id}
                            className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-auto cursor-pointer hover:bg-blue-500/20 transition-colors"
                            style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: `${box.width}%`,
                                height: `${box.height}%`,
                            }}
                            title={box.text}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

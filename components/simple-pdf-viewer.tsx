'use client';

import * as React from 'react';
import { Worker } from '@react-pdf-viewer/core';
import { Viewer } from '@react-pdf-viewer/core';
import { RenderGoToPageProps } from '@react-pdf-viewer/page-navigation';
import { toolbarPlugin, ToolbarSlot } from '@react-pdf-viewer/toolbar';
import { searchPlugin } from '@react-pdf-viewer/search';
import { getFilePlugin } from '@react-pdf-viewer/get-file';
import { fullScreenPlugin } from '@react-pdf-viewer/full-screen';
import { Search, Download, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/toolbar/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/full-screen/lib/styles/index.css';

interface SimplePdfViewerProps {
    pdfUrl: string;
}

export const SimplePdfViewer: React.FC<SimplePdfViewerProps> = ({ 
    pdfUrl 
}) => {
    const searchPluginInstance = searchPlugin();
    const getFilePluginInstance = getFilePlugin();
    const fullScreenPluginInstance = fullScreenPlugin();
    
    const toolbarPluginInstance = toolbarPlugin();
    const { Toolbar } = toolbarPluginInstance;
    const { Download: DownloadComponent } = getFilePluginInstance;
    const { EnterFullScreen } = fullScreenPluginInstance;

    return (
        <div className="h-full">
            <Worker workerUrl='https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js'>
                <div
                    className="bg-white dark:bg-black h-full flex flex-col"
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
                    <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-black">
                        <Viewer 
                            fileUrl={pdfUrl} 
                            plugins={[
                                toolbarPluginInstance, 
                                searchPluginInstance, 
                                getFilePluginInstance, 
                                fullScreenPluginInstance
                            ]} 
                        />
                    </div>
                </div>
            </Worker>
        </div>
    );
};

'use client';

import * as React from 'react';
import { Worker } from '@react-pdf-viewer/core';
import { Viewer } from '@react-pdf-viewer/core';
import { RenderGoToPageProps } from '@react-pdf-viewer/page-navigation';
import { toolbarPlugin, ToolbarSlot } from '@react-pdf-viewer/toolbar';
import { searchPlugin } from '@react-pdf-viewer/search';
import { getFilePlugin } from '@react-pdf-viewer/get-file';
import { fullScreenPlugin } from '@react-pdf-viewer/full-screen';
import { Search, Download, Maximize2, ChevronLeft, ChevronRight, X, Palette, FileText } from 'lucide-react';
import { BoundingBoxLayer, TooltipLayer } from './pdf-bounding-boxes';
import { AnnotationLayer, AnnotationTooltipLayer } from './pdf-annotations';
import { AnnotationMenu } from './annotation-menu';
import { ExtractionInfoViewer } from './extraction-info-viewer';
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

// Types for annotation data
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

interface PdfViewerWithOverlayProps {
    pdfUrl: string;
    boundingBoxes?: BoundingBox[];
    user?: string; // Optional user ID for fetching bounding boxes
    fileName?: string;
    onExplain?: (problemText: string, solution: string) => void;
}

export const PdfViewerWithOverlay: React.FC<PdfViewerWithOverlayProps> = ({ 
    pdfUrl, 
    user,
    boundingBoxes = [], 
    fileName = "",
    onExplain
}) => {
    const [apiBoundingBoxes, setApiBoundingBoxes] = React.useState<BoundingBox[]>([]);
    const [selectedBoxes, setSelectedBoxes] = React.useState<Map<string, { box: BoundingBox; position: { x: number; y: number }; isVisible: boolean; solution?: string; isLoading?: boolean }>>(new Map());
    const [frontTooltipId, setFrontTooltipId] = React.useState<string | null>(null);
    const [preloadedAnswers, setPreloadedAnswers] = React.useState<Map<string, string>>(new Map());
    
    // Annotation states
    const [annotations, setAnnotations] = React.useState<Annotation[]>([]);
    const [selectedAnnotations, setSelectedAnnotations] = React.useState<Map<string, { annotation: Annotation; position: { x: number; y: number }; isVisible: boolean; isEditing?: boolean }>>(new Map());
    const [frontAnnotationId, setFrontAnnotationId] = React.useState<string | null>(null);
    const [isAnnotationMode, setIsAnnotationMode] = React.useState(false);
    const [selectedAnnotationType, setSelectedAnnotationType] = React.useState<'highlight' | 'note' | 'comment'>('highlight');
    const [selectedColor, setSelectedColor] = React.useState('#fbbf24');
    
    // Extraction viewer states
    const [isExtractionViewerOpen, setIsExtractionViewerOpen] = React.useState(false);
    const [extractionData, setExtractionData] = React.useState<any>(null);
    const [isLoadingExtraction, setIsLoadingExtraction] = React.useState(false);
    
    const pdfContainerRef = React.useRef<HTMLDivElement>(null);

    // Function to fetch extraction data
    const fetchExtractionData = React.useCallback(async () => {
        if (!fileName) return;
        
        setIsLoadingExtraction(true);
        setIsExtractionViewerOpen(true); // Open immediately to show loading state
        
        try {
            const response = await fetch(`/api/extraction-info?filename=${encodeURIComponent(fileName)}`);
            const result = await response.json();
            
            if (response.ok) {
                setExtractionData(result.extractionData);
            } else {
                console.error('Failed to fetch extraction data:', result.error);
                // Still keep viewer open to show "no data" message
                setExtractionData(null);
            }
        } catch (error) {
            console.error('Error fetching extraction data:', error);
            setExtractionData(null);
        } finally {
            setIsLoadingExtraction(false);
        }
    }, [fileName]);

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

    // Preload all answers for this document when it opens
    React.useEffect(() => {
        const preloadAnswers = async () => {
            if (!fileName) return;
            
            try {
                const response = await fetch(`/api/document-answers?fileName=${encodeURIComponent(fileName)}`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.answers && data.answers.length > 0) {
                        const answersMap = new Map<string, string>();
                        
                        // Group answers by tooltip_id and take the most recent (first in array since ordered by id desc)
                        const groupedAnswers = data.answers.reduce((acc: Record<string, any>, answer: any) => {
                            if (!acc[answer.tooltip_id] || acc[answer.tooltip_id].id < answer.id) {
                                acc[answer.tooltip_id] = answer;
                            }
                            return acc;
                        }, {});
                        
                        // Convert to map for easy lookup
                        Object.values(groupedAnswers).forEach((answer: any) => {
                            answersMap.set(answer.tooltip_id, answer.response);
                        });
                        
                        setPreloadedAnswers(answersMap);
                        console.log(`Preloaded ${answersMap.size} answers for document: ${fileName}`);
                    }
                }
            } catch (error) {
                console.error('Failed to preload answers:', error);
            }
        };

        preloadAnswers();
    }, [fileName]);

    // Handler to update preloaded answers when new answers are saved
    const handleAnswerSaved = React.useCallback((tooltipId: string, answer: string) => {
        setPreloadedAnswers(prev => {
            const newMap = new Map(prev);
            newMap.set(tooltipId, answer);
            return newMap;
        });
    }, []);
    // Fetch annotations from API
    React.useEffect(() => {
        const fetchAnnotations = async () => {
            if (!user || !fileName) return;
            
            try {
                const params = new URLSearchParams();
                params.append('userId', user);
                params.append('filename', fileName);
                
                const response = await fetch(`/api/annotations?${params.toString()}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('Fetched annotations:', data);
                    setAnnotations(data);
                } else {
                    console.error('Failed to fetch annotations');
                }
            } catch (error) {
                console.error('Error fetching annotations:', error);
            }
        };

        fetchAnnotations();
    }, [user, fileName]);

    // Handle creating new annotation
    const handleCreateAnnotation = async (x: number, y: number, width: number, height: number, pageNumber: number) => {
        if (!user || !fileName) {
            console.log('Missing user or fileName:', { user, fileName });
            return;
        }
        
        console.log('Creating annotation with:', { x, y, width, height, pageNumber, user, fileName });
        
        // Create optimistic annotation with temporary ID
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const optimisticAnnotation = {
            id: tempId,
            user_id: user,
            document_name: fileName,
            page_number: pageNumber,
            x,
            y,
            width,
            height,
            text: '',
            color: selectedColor,
            type: selectedAnnotationType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Update UI immediately with optimistic annotation
        setAnnotations(prev => [...prev, optimisticAnnotation]);
        
        // If it's a note or comment annotation, automatically open the text editor
        if (selectedAnnotationType === 'note' || selectedAnnotationType === 'comment') {
            setTimeout(() => {
                // Create a dummy position for the tooltip
                const position = {
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2
                };
                
                setSelectedAnnotations(prev => {
                    const newMap = new Map(prev);
                    newMap.set(tempId, {
                        annotation: optimisticAnnotation,
                        position,
                        isVisible: true,
                        isEditing: true
                    });
                    return newMap;
                });
            }, 100);
        }
        
        // Perform server creation asynchronously
        try {
            const response = await fetch('/api/annotations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user,
                    documentName: fileName,
                    pageNumber,
                    x,
                    y,
                    width,
                    height,
                    text: '',
                    color: selectedColor,
                    type: selectedAnnotationType,
                }),
            });

            if (response.ok) {
                const serverAnnotation = await response.json();
                
                // Replace optimistic annotation with server annotation
                setAnnotations(prev => prev.map(ann => 
                    ann.id === tempId ? serverAnnotation : ann
                ));
                
                // Update tooltip with real annotation ID if it's open
                setSelectedAnnotations(prev => {
                    const newMap = new Map(prev);
                    const tooltip = newMap.get(tempId);
                    if (tooltip) {
                        newMap.delete(tempId);
                        newMap.set(serverAnnotation.id, {
                            ...tooltip,
                            annotation: serverAnnotation
                        });
                    }
                    return newMap;
                });
                
                console.log('Created annotation:', serverAnnotation);
            } else {
                console.error('Failed to create annotation on server');
                // Remove optimistic annotation on failure
                setAnnotations(prev => prev.filter(ann => ann.id !== tempId));
                setSelectedAnnotations(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(tempId);
                    return newMap;
                });
            }
        } catch (error) {
            console.error('Error creating annotation:', error);
            // Remove optimistic annotation on error
            setAnnotations(prev => prev.filter(ann => ann.id !== tempId));
            setSelectedAnnotations(prev => {
                const newMap = new Map(prev);
                newMap.delete(tempId);
                return newMap;
            });
        }
    };

    // Handle annotation deletion
    const handleAnnotationDeleted = (annotationId: string) => {
        setAnnotations(prev => prev.filter(annotation => annotation.id !== annotationId));
    };

    // Handle annotation update
    const handleAnnotationUpdated = (updatedAnnotation: Annotation) => {
        setAnnotations(prev => prev.map(annotation => 
            annotation.id === updatedAnnotation.id ? updatedAnnotation : annotation
        ));
    };

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
                pageWidth={renderPageProps.pageWidth}
                pageHeight={renderPageProps.pageHeight}
            />
        ),
    });
    
    // Create a custom plugin to render annotations on each page
    const annotationPlugin = () => ({
        renderPageLayer: (renderPageProps: any) => (
            <AnnotationLayer
                annotations={annotations}
                renderPageProps={renderPageProps}
                setSelectedAnnotations={setSelectedAnnotations}
                setFrontAnnotationId={setFrontAnnotationId}
                pageWidth={renderPageProps.pageWidth}
                pageHeight={renderPageProps.pageHeight}
                isAnnotationMode={isAnnotationMode}
                onCreateAnnotation={handleCreateAnnotation}
            />
        ),
    });
    
    const boundingBoxPluginInstance = boundingBoxPlugin();
    const annotationPluginInstance = annotationPlugin();
    
    const toolbarPluginInstance = toolbarPlugin();
    const { Toolbar } = toolbarPluginInstance;
    const { Download: DownloadComponent } = getFilePluginInstance;
    const { EnterFullScreen } = fullScreenPluginInstance;

    return (
        <div className="overflow-y-scroll max-h-[91vh]">
            <Worker workerUrl='https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js'>
                <div
                    className="bg-white dark:bg-black h-full flex flex-col"
                >
                    <div className="sticky top-0 z-10 bg-white dark:bg-black shadow-sm">
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

                                            {/* Right side - Extraction viewer, Annotations toggle, Download and Full screen */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={fetchExtractionData}
                                                    disabled={isLoadingExtraction}
                                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
                                                    title="View Document AI Extraction"
                                                >
                                                    {isLoadingExtraction ? (
                                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <FileText className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                    )}
                                                </button>
                                                
                                                <button
                                                    onClick={() => setIsAnnotationMode(!isAnnotationMode)}
                                                    className={`p-2 rounded-md transition-colors ${
                                                        isAnnotationMode
                                                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                    }`}
                                                    title={isAnnotationMode ? 'Exit annotation mode' : 'Enter annotation mode'}
                                                >
                                                    {isAnnotationMode ? (
                                                        <X className="w-4 h-4" />
                                                    ) : (
                                                        <Palette className="w-4 h-4" />
                                                    )}
                                                </button>
                                                
                                                <div className="border-l border-gray-300 dark:border-gray-600 pl-2">
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
                                        </div>
                                    );
                                }}
                            </Toolbar>
                        </div>
                        
                        {/* Annotations toolbar on second line - only show when annotation mode is active */}
                        {isAnnotationMode && (
                            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                                <AnnotationMenu
                                    isAnnotationMode={isAnnotationMode}
                                    onToggleAnnotationMode={() => setIsAnnotationMode(!isAnnotationMode)}
                                    selectedAnnotationType={selectedAnnotationType}
                                    onAnnotationTypeChange={setSelectedAnnotationType}
                                    selectedColor={selectedColor}
                                    onColorChange={setSelectedColor}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-hidden bg-white dark:bg-white" ref={pdfContainerRef}>
                        <Viewer 
                            fileUrl={pdfUrl} 
                            plugins={[
                                toolbarPluginInstance, 
                                searchPluginInstance, 
                                getFilePluginInstance, 
                                fullScreenPluginInstance,
                                boundingBoxPluginInstance,
                                annotationPluginInstance
                            ]} 
                        />
                    </div>
                </div>
            </Worker>

            {/* Backdrop overlay when any tooltip is open */}
            {(selectedBoxes.size > 0 || selectedAnnotations.size > 0) && (
                <div
                    className={`fixed inset-0 bg-black transition-opacity duration-200 ease-out z-10 pointer-events-none ${
                        Array.from(selectedBoxes.values()).some(tooltip => tooltip.isVisible) || 
                        Array.from(selectedAnnotations.values()).some(tooltip => tooltip.isVisible) 
                            ? 'bg-opacity-20' : 'bg-opacity-0'
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
                onExplain={onExplain}
                preloadedAnswers={preloadedAnswers}
                onAnswerSaved={handleAnswerSaved}
            />

            {/* Render annotation tooltips */}
            <AnnotationTooltipLayer
                selectedAnnotations={selectedAnnotations}
                setSelectedAnnotations={setSelectedAnnotations}
                frontAnnotationId={frontAnnotationId}
                setFrontAnnotationId={setFrontAnnotationId}
                userId={user}
                documentName={fileName}
                onAnnotationDeleted={handleAnnotationDeleted}
                onAnnotationUpdated={handleAnnotationUpdated}
            />
            
            {/* Extraction Info Viewer */}
            <ExtractionInfoViewer
                extractionData={extractionData}
                isOpen={isExtractionViewerOpen}
                onClose={() => setIsExtractionViewerOpen(false)}
                fileName={fileName}
            />
        </div>
    );
};

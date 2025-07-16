'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { usePdf } from '@mikecousins/react-pdf';

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
    const [baseScale, setBaseScale] = useState(1.0);
    const [loadedBoundingBoxes, setLoadedBoundingBoxes] = useState<BoundingBox[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dummyCanvasRef = useRef<HTMLCanvasElement>(null);
    
    // Use provided bounding boxes, loaded ones, or default test boxes
    const activeBoundingBoxes = boundingBoxes.length > 0 ? boundingBoxes : 
        loadedBoundingBoxes.length > 0 ? loadedBoundingBoxes : 
        [
            // Default test bounding boxes that always show
            {
                id: "default-test-1",
                x: 100,
                y: 120,
                width: 300,
                height: 25,
                text: "Test Bounding Box 1",
                pageNumber: 1
            },
            {
                id: "default-test-2",
                x: 100,
                y: 180,
                width: 400,
                height: 40,
                text: "Test Bounding Box 2 - Click to select",
                pageNumber: 1
            },
            {
                id: "default-test-3",
                x: 100,
                y: 250,
                width: 250,
                height: 20,
                text: "Test Bounding Box 3",
                pageNumber: 1
            }
        ];

    const { pdfDocument } = usePdf({
        file: pdfUrl,
        canvasRef: dummyCanvasRef,
        scale: baseScale,
    });

    // Calculate base scale when PDF loads or container size changes
    useEffect(() => {
        if (pdfDocument && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            
            const calculateScale = () => {
                const containerWidth = container.clientWidth - 16; // Account for padding
                const containerHeight = container.clientHeight - 16; // Account for padding
                
                // Get first page to calculate dimensions
                pdfDocument.getPage(1).then(page => {
                    const viewport = page.getViewport({ scale: 1 });
                    const pdfWidth = viewport.width;
                    const pdfHeight = viewport.height;
                    
                    // Calculate scale to fit width with some margin
                    const widthScale = (containerWidth * 0.95) / pdfWidth; // 95% of container width
                    
                    // For height, assume we want to fit at least one page comfortably
                    const heightScale = (containerHeight * 0.8) / pdfHeight; // 80% of container height
                    
                    // Use width scale primarily, but don't exceed reasonable height
                    const finalScale = Math.min(widthScale, heightScale, 1.0); // Cap at 1.0x
                    
                    console.log('Setting baseScale to:', finalScale, 'containerWidth:', containerWidth, 'containerHeight:', containerHeight, 'pdfWidth:', pdfWidth, 'pdfHeight:', pdfHeight);
                    setBaseScale(Math.max(finalScale, 0.3)); // Minimum scale of 0.3
                });
            };
            
            // Calculate initial scale
            calculateScale();
            
            // Debounced resize handler
            let resizeTimeout: NodeJS.Timeout;
            const debouncedResize = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    console.log('Resize debounce complete, recalculating scale...');
                    calculateScale();
                }, 300); // Wait 300ms after resize stops
            };
            
            // Add resize listener
            window.addEventListener('resize', debouncedResize);
            
            // Cleanup
            return () => {
                window.removeEventListener('resize', debouncedResize);
                clearTimeout(resizeTimeout);
            };
        }
    }, [pdfDocument]);

    // Load bounding boxes when PDF URL changes
    useEffect(() => {
        if (pdfUrl && boundingBoxes.length === 0) {
            // Try to extract filename from URL for local files
            const filename = pdfUrl.split('/').pop() || '';
            if (filename.includes('.pdf')) {
                loadBoundingBoxesForPdf(filename);
            }
        }
    }, [pdfUrl, boundingBoxes.length]);

    const loadBoundingBoxesForPdf = async (filename: string) => {
        try {
            // Try to load bounding boxes from a JSON file with the same name
            const jsonFilename = filename.replace('.pdf', '.json');
            const response = await fetch(`/${jsonFilename}`);
            
            if (response.ok) {
                const data = await response.json();
                setLoadedBoundingBoxes(data);
                console.log('Loaded bounding boxes for PDF:', data);
            } else {
                console.log('No bounding boxes found for PDF, using test data');
                // Use test bounding boxes for demonstration
                const testBoundingBoxes = [
                    {
                        id: "test-title-1",
                        x: 72,
                        y: 100,
                        width: 400,
                        height: 32,
                        text: "Document Title",
                        pageNumber: 1
                    },
                    {
                        id: "test-subtitle-1",
                        x: 72,
                        y: 150,
                        width: 300,
                        height: 20,
                        text: "Subtitle or Section Header",
                        pageNumber: 1
                    },
                    {
                        id: "test-paragraph-1",
                        x: 72,
                        y: 200,
                        width: 450,
                        height: 60,
                        text: "This is a test paragraph that demonstrates bounding box functionality. It shows how text regions can be highlighted and made interactive.",
                        pageNumber: 1
                    },
                    {
                        id: "test-list-1",
                        x: 90,
                        y: 280,
                        width: 400,
                        height: 16,
                        text: "• First bullet point item",
                        pageNumber: 1
                    },
                    {
                        id: "test-list-2",
                        x: 90,
                        y: 300,
                        width: 350,
                        height: 16,
                        text: "• Second bullet point item",
                        pageNumber: 1
                    },
                    {
                        id: "test-list-3",
                        x: 90,
                        y: 320,
                        width: 380,
                        height: 16,
                        text: "• Third bullet point item",
                        pageNumber: 1
                    },
                    {
                        id: "test-section-2",
                        x: 72,
                        y: 380,
                        width: 280,
                        height: 22,
                        text: "Another Section",
                        pageNumber: 1
                    },
                    {
                        id: "test-paragraph-2",
                        x: 72,
                        y: 420,
                        width: 450,
                        height: 80,
                        text: "Another paragraph with more content to show how multiple bounding boxes work together on the same page.",
                        pageNumber: 1
                    },
                    {
                        id: "test-page2-title",
                        x: 72,
                        y: 100,
                        width: 350,
                        height: 28,
                        text: "Page 2 Title",
                        pageNumber: 2
                    },
                    {
                        id: "test-page2-content",
                        x: 72,
                        y: 150,
                        width: 400,
                        height: 100,
                        text: "Content on page 2 demonstrating multi-page bounding box support.",
                        pageNumber: 2
                    }
                ];
                setLoadedBoundingBoxes(testBoundingBoxes);
            }
        } catch (error) {
            console.error('Error loading bounding boxes:', error);
            setLoadedBoundingBoxes([]);
        }
    };

    // PDF page component
    const PdfPage = memo(({ pageNumber, scale }: { pageNumber: number, scale: number }) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const pageRef = useRef<HTMLDivElement>(null);
        
        const { pdfPage } = usePdf({
            file: pdfUrl,
            page: pageNumber,
            canvasRef,
            scale: scale,
        });

        // Get bounding boxes for this page
        const pageBoundingBoxes = activeBoundingBoxes.filter(box => box.pageNumber === pageNumber);

        return (
            <div ref={pageRef} className="mb-4 bg-white shadow-sm rounded w-full flex-shrink-0">
                <div className="relative">
                    <canvas ref={canvasRef} className="w-full h-auto max-w-full" />
                    
                    {/* Render bounding boxes if provided */}
                    {pageBoundingBoxes.length > 0 && (
                        <BoundingBoxesForPage boxes={pageBoundingBoxes} scale={scale} />
                    )}
                </div>
                <div className="text-center text-sm text-muted-foreground p-2">
                    Page {pageNumber}
                </div>
            </div>
        );
    }, (prevProps, nextProps) => {
        return prevProps.pageNumber === nextProps.pageNumber && prevProps.scale === nextProps.scale;
    });

    // Bounding box component
    const BoundingBoxesForPage = memo(({ boxes, scale }: { boxes: BoundingBox[], scale: number }) => {
        const [selectedBox, setSelectedBox] = useState<string | null>(null);

        const handleBoxClick = (boxId: string) => {
            setSelectedBox(prev => prev === boxId ? null : boxId);
        };

        return (
            <>
                {boxes.map((box) => (
                    <div
                        key={box.id}
                        className={`absolute border-2 cursor-pointer transition-all duration-200 ${
                            selectedBox === box.id 
                                ? 'border-blue-500 bg-blue-500 bg-opacity-20' 
                                : 'border-red-500 bg-red-500 bg-opacity-10 hover:bg-opacity-20'
                        }`}
                        style={{
                            left: `${box.x * scale}px`,
                            top: `${box.y * scale}px`,
                            width: `${box.width * scale}px`,
                            height: `${box.height * scale}px`,
                        }}
                        onClick={() => handleBoxClick(box.id)}
                        title={`Text: "${box.text}" | Position: (${Math.round(box.x * scale)}, ${Math.round(box.y * scale)})`}
                    >
                        <div className="absolute -top-6 -left-1 text-xs bg-black text-white px-1 rounded opacity-0 hover:opacity-100 transition-opacity">
                            ({Math.round(box.x * scale)}, {Math.round(box.y * scale)})
                        </div>
                    </div>
                ))}
            </>
        );
    }, (prevProps, nextProps) => {
        return prevProps.boxes === nextProps.boxes && prevProps.scale === nextProps.scale;
    });

    if (!pdfDocument) {
        return (
            <div className="flex items-center justify-center h-64">
                <span className="text-lg text-muted-foreground">Loading PDF...</span>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-[90vh] w-full ${className}`}>
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-auto p-2 min-h-0"
                style={{ 
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#cbd5e1 #f1f5f9'
                }}
            >
                <div className="flex flex-col items-center gap-2">
                    <div className="w-full max-w-full">
                        {Array.from({ length: pdfDocument.numPages }, (_, i) => (
                            <PdfPage key={i + 1} pageNumber={i + 1} scale={baseScale} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

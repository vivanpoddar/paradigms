'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
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

const MyPdfViewer = () => {
    const [baseScale, setBaseScale] = useState(1.0); // Scale when PDF fits in container
    const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dummyCanvasRef = useRef<HTMLCanvasElement>(null);

    const { pdfDocument } = usePdf({
        file: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf', // Using a sample PDF for testing
        canvasRef: dummyCanvasRef, // Dummy ref, we'll handle canvas refs individually
        scale: baseScale, // Use base scale for rendering, CSS handles zoom
    });

    // Load bounding boxes from JSON file
    useEffect(() => {
        const loadBoundingBoxesFromJson = async () => {
            try {
                // Load example bounding boxes from public directory
                const response = await fetch('/bounding-boxes.json');
                console.log('Fetch response status:', response.status);
                
                if (response.ok) {
                    const data: BoundingBox[] = await response.json();
                    console.log('Loaded bounding boxes:', data);
                    setBoundingBoxes(data);
                } else {
                    console.warn('Could not load bounding boxes JSON file, using fallback data');
                    // Fallback example data
                    const fallbackData: BoundingBox[] = [
                        {
                            id: "fallback-1",
                            x: 50,
                            y: 100,
                            width: 200,
                            height: 30,
                            text: "Example Title",
                            pageNumber: 1
                        },
                        {
                            id: "fallback-2",
                            x: 50,
                            y: 150,
                            width: 300,
                            height: 20,
                            text: "This is example paragraph text",
                            pageNumber: 1
                        },
                        {
                            id: "fallback-3",
                            x: 50,
                            y: 200,
                            width: 250,
                            height: 18,
                            text: "Another line of example text",
                            pageNumber: 1
                        }
                    ];
                    setBoundingBoxes(fallbackData);
                }
            } catch (error) {
                console.error('Error loading bounding boxes:', error);
                // Use fallback data on error
                const fallbackData: BoundingBox[] = [
                    {
                        id: "error-fallback-1",
                        x: 50,
                        y: 100,
                        width: 200,
                        height: 30,
                        text: "Fallback Title",
                        pageNumber: 1
                    },
                    {
                        id: "error-fallback-2",
                        x: 50,
                        y: 150,
                        width: 300,
                        height: 20,
                        text: "Fallback paragraph text",
                        pageNumber: 1
                    }
                ];
                setBoundingBoxes(fallbackData);
            }
        };

        if (pdfDocument && baseScale > 0) {
            console.log('Loading bounding boxes, baseScale:', baseScale);
            loadBoundingBoxesFromJson();
        }
    }, [pdfDocument, baseScale]);

    // Calculate base scale when PDF loads or container size changes
    useEffect(() => {
        if (pdfDocument && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const containerWidth = container.clientWidth - 64; // Account for padding and margins
            
            // Get first page to calculate dimensions
            pdfDocument.getPage(1).then(page => {
                const viewport = page.getViewport({ scale: 1 });
                const pdfWidth = viewport.width;
                
                // Calculate scale to fit width with some margin
                const widthScale = Math.min(containerWidth / pdfWidth, 1.2); // Cap at 1.2x for readability
                
                setBaseScale(widthScale);
            });
        }
    }, [pdfDocument]);

    // Pure PDF component - no bounding box logic at all
    const PdfPage = memo(({ pageNumber }: { pageNumber: number }) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const pageRef = useRef<HTMLDivElement>(null);
        
        const { pdfPage } = usePdf({
            file: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
            page: pageNumber,
            canvasRef,
            scale: baseScale,
        });

        // Get bounding boxes for this page
        const pageBoundingBoxes = boundingBoxes.filter(box => box.pageNumber === pageNumber);

        return (
            <div ref={pageRef} className="mb-4 bg-white shadow-sm rounded w-full">
                <div className="relative">
                    <canvas ref={canvasRef} className="w-full h-auto" />
                    
                    {/* Render bounding boxes directly on each page */}
                    <BoundingBoxesForPage boxes={pageBoundingBoxes} />
                </div>
                <div className="text-center text-sm text-muted-foreground p-2">
                    Page {pageNumber}
                </div>
            </div>
        );
    });

    // Simple bounding box component for a single page
    const BoundingBoxesForPage = memo(({ boxes }: { boxes: BoundingBox[] }) => {
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
                            left: `${box.x}px`,
                            top: `${box.y}px`,
                            width: `${box.width}px`,
                            height: `${box.height}px`,
                        }}
                        onClick={() => handleBoxClick(box.id)}
                        title={`Text: "${box.text}" | Position: (${Math.round(box.x)}, ${Math.round(box.y)})`}
                    >
                        <div className="absolute -top-6 -left-1 text-xs bg-black text-white px-1 rounded opacity-0 hover:opacity-100 transition-opacity">
                            ({Math.round(box.x)}, {Math.round(box.y)})
                        </div>
                    </div>
                ))}
            </>
        );
    });

    return (
        <div className='flex h-screen'>
            <div className="w-full flex flex-col p-4 h-full bg-background">
                {!pdfDocument && (
                    <div className="text-center p-4">
                        <span className="text-lg text-foreground">Loading PDF...</span>
                    </div>
                )}
                
                {pdfDocument && (
                    <div 
                        ref={scrollContainerRef}
                        className="flex-1 bg-card border border-border rounded-lg shadow-lg overflow-auto min-h-0 p-4 relative"
                    >
                        <div className="flex flex-col items-center">
                            <div className="w-full max-w-full">
                                {pdfDocument && Array.from({ length: pdfDocument.numPages }, (_, i) => (
                                    <PdfPage key={i + 1} pageNumber={i + 1} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyPdfViewer;
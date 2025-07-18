'use client';

import { Worker } from '@react-pdf-viewer/core';
import * as React from 'react';
import { Viewer } from '@react-pdf-viewer/core';
import { toolbarPlugin } from '@react-pdf-viewer/toolbar';
import type { ToolbarSlot, TransformToolbarSlot } from '@react-pdf-viewer/toolbar';
import { themePlugin, ThemePlugin } from '@react-pdf-viewer/theme';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/toolbar/lib/styles/index.css';


import '@react-pdf-viewer/toolbar/lib/styles/index.css'; 
import '@react-pdf-viewer/core/lib/styles/index.css';

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
    const toolbarPluginInstance = toolbarPlugin();
    const { renderDefaultToolbar, Toolbar } = toolbarPluginInstance;

    const transform: TransformToolbarSlot = (slot: ToolbarSlot) => {
        const { NumberOfPages } = slot;
        return Object.assign({}, slot, {
            NumberOfPages: () => (
                <>
                    of <NumberOfPages />
                </>
            ),
        });
    };

    return (
        <Worker workerUrl='https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js'>
        <div
            className="rpv-core__viewer"
            style={{
                border: '1px solid rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                height: '91vh',
            }}
        >
            <div
                style={{
                    alignItems: 'center',
                    backgroundColor: '#eeeeee',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    padding: '4px',
                }}
            >
                <Toolbar>{renderDefaultToolbar(transform)}</Toolbar>
            </div>
            <div
                style={{
                    flex: 1,
                    overflow: 'hidden',
                }}
            >
                    <Viewer fileUrl={pdfUrl} plugins={[toolbarPluginInstance]} />
            </div>
        </div>
        </Worker>
    );
};

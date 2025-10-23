import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import fs from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'

console.log('Processing mparse-simple route...')

// Type definitions for Mathpix OCR response
interface MathpixLine {
    text: string;
    type?: string;
    region?: {
        top_left_x: number;
        top_left_y: number;
        width: number;
        height: number;
    };
    confidence?: number;
    line?: string;
}

interface MathpixPage {
    lines: MathpixLine[];
    page_width: number;
    page_height: number;
}

interface MathpixResponse {
    pdf_id: string;
    status?: string;
    pages?: MathpixPage[];
    [key: string]: any;
}

interface LlamaIndexDocument {
    text: string;
    metadata: {
        fileName: string;
        userId: string;
        uploadPath: string;
        bucketName: string;
        processingDate: string;
        documentType: string;
        source: string;
        pageNumber: number;
        totalPages: number;
        lineCount: number;
        boundingBoxes: Array<{
            lineIndex: number;
            text: string;
            type: string;
            region: any;
            confidence: number | null;
        }>;
        extractedLines: Array<{
            text: string;
            type: string;
            region: any;
            lineIndex: number;
            confidence: number | null;
        }>;
    };
}

// Function to wait for pipeline indexing completion using pipeline status API
const waitForPipelineIndexingCompletion = async (pipelineId: string, timeoutMs: number = 120000): Promise<boolean> => {
    const startTime = Date.now();
    const pollInterval = 250; // Check every 250ms

    while (Date.now() - startTime < timeoutMs) {
        try {
            // Get pipeline status using LlamaIndex API
            const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/v1/pipelines/${pipelineId}/status`, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`
                }
            });

            if (statusResponse.ok) {
                const status = await statusResponse.json() as any;

                // Check if indexing is complete
                if (status.status === 'SUCCESS' || status.status === 'completed') {
                    return true;
                } else {
                    console.error("Error: No valid response from indexing")
                }
            } else {
                const errorText = await statusResponse.text();
                console.log(`Error details: ${errorText}`);
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));

        } catch (error) {
            // Continue polling despite errors
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    console.log(`Pipeline indexing poll timeout after ${timeoutMs}ms for pipeline: ${pipelineId}`);
    return false;
};

export async function POST(request: NextRequest) {
    const processingStartTime = Date.now();
    
    console.log('🔥 MPARSE-SIMPLE ROUTE CALLED - Math parsing without question detection!')

    try {
        const { fileName, bucketName, uploadPath, userId } = await request.json()
        
        console.log(`📋 MPARSE-SIMPLE: Processing file ${fileName} for user ${userId}`)

        // Validate required fields
        if (!fileName || !bucketName || !uploadPath || !userId) {
            console.error('❌ MPARSE-SIMPLE: Missing required fields')
            return NextResponse.json(
                { error: 'Missing required fields: fileName, bucketName, uploadPath, userId' },
                { status: 400 }
            )
        }

        // Initialize Supabase client
        const supabase = await createClient()

        // Download file from Supabase storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(uploadPath)

        if (downloadError) {
            console.error('Supabase download error:', downloadError)
            return NextResponse.json(
                { error: `Failed to download file: ${downloadError.message}` },
                { status: 500 }
            )
        }

        if (!fileData) {
            return NextResponse.json(
                { error: 'No file data received from Supabase' },
                { status: 500 }
            )
        }

        // Declare temp file paths for cleanup
        let tempFilePath: string | undefined = undefined;

        try {
            // Convert blob to buffer and write to temporary file
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Create a temporary file for the uploaded PDF
            const tempFileName = fileName;
            tempFilePath = join(tmpdir(), tempFileName);
            await writeFile(tempFilePath, buffer);

            // Create function to upload OCR content as a file to LlamaIndex
            const uploadOCRAsFileToLlamaIndex = async (documents: LlamaIndexDocument[]): Promise<any | null> => {
                try {
                    // Create a comprehensive text file with all OCR content and metadata
                    const allText = documents.map(doc => {
                        return doc.text;
                    }).join('\n');

                    // Create text file
                    const textFileName = fileName.replace(/\.(pdf|doc|docx)$/i, '.txt');
                    const textFilePath = join(tmpdir(), textFileName);
                    await writeFile(textFilePath, allText);

                    // Upload as file to LlamaIndex
                    const fileFormData = new FormData();
                    const textFileStream = fs.createReadStream(textFilePath);

                    fileFormData.append("upload_file", textFileStream);
                    fileFormData.append("external_file_id", `${fileName}_ocr_${Date.now()}`);
                    fileFormData.append("project_id", "2a2234b3-7c0c-4436-b09c-db61e7e5b546");
                    fileFormData.append("pipeline_id", "f60d5a9e-a5c9-4a23-98c4-379986f02020");

                    const fileUploadResponse = await fetch("https://api.cloud.llamaindex.ai/api/v1/files", {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Authorization": `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`
                        },
                        body: fileFormData
                    });

                    if (!fileUploadResponse.ok) {
                        const errorText = await fileUploadResponse.text();
                        console.error('❌ OCR text file upload failed:', {
                            status: fileUploadResponse.status,
                            statusText: fileUploadResponse.statusText,
                            errorText
                        });

                        // Clean up temp file
                        await unlink(textFilePath);
                        return null;
                    }

                    const fileResult = await fileUploadResponse.json() as { id?: string;[key: string]: any };

                    // Add the file to the pipeline if it has an ID
                    if (fileResult && fileResult.id) {
                        try {
                            const addToPipelineResponse = await fetch(`https://api.cloud.llamaindex.ai/api/v1/pipelines/f60d5a9e-a5c9-4a23-98c4-379986f02020/files`, {
                                method: "PUT",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Accept": "application/json",
                                    "Authorization": `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`
                                },
                                body: JSON.stringify([{
                                    file_id: fileResult.id,
                                    custom_metadata: {
                                        fileName: fileName,
                                        userId: userId,
                                        uploadPath: uploadPath,
                                        bucketName: bucketName,
                                        processingDate: new Date().toISOString(),
                                        documentType: 'math-homework-ocr',
                                        source: 'mathpix-ocr-processed-simple',
                                        totalPages: documents.length,
                                        totalBoundingBoxes: documents.reduce((sum, doc) => sum + doc.metadata.boundingBoxes.length, 0)
                                    }
                                }])
                            });

                        } catch (pipelineError) {
                            console.error("Pipeline addition failed:", pipelineError);
                        }
                    }

                    // Clean up temp file
                    await unlink(textFilePath);

                    return fileResult;
                } catch (error) {
                    console.error("OCR file upload error:", error);
                    return null;
                }
            };

            // Create LlamaIndex Documents from OCR output with metadata
            const createLlamaIndexDocuments = async (mathpixResult: MathpixResponse, lines: string): Promise<LlamaIndexDocument[]> => {
                try {

                    if (!mathpixResult || !Array.isArray(mathpixResult.pages)) {
                        throw new Error('Invalid Mathpix result structure');
                    }

                    const documents: LlamaIndexDocument[] = [];

                    // Create a document for each page with detailed metadata
                    for (let pageIndex = 0; pageIndex < mathpixResult.pages.length; pageIndex++) {
                        const page = mathpixResult.pages[pageIndex];

                        if (!Array.isArray(page.lines)) {
                            continue;
                        }

                        // Extract text and collect bounding box information
                        const pageLines = page.lines.map((line: MathpixLine, lineIndex: number) => ({
                            text: line.text || '',
                            type: line.type || 'text',
                            region: line.region || null,
                            lineIndex: lineIndex,
                            confidence: line.confidence || null
                        }));

                        const pageText = pageLines
                            .filter((line: any) => line.text.trim() !== '')
                            .map((line: any) => line.text)
                            .join(' ');

                        if (pageText.trim() === '') {
                            continue;
                        }

                        // Create document with comprehensive metadata
                        const document: LlamaIndexDocument = {
                            text: lines,
                            metadata: {
                                fileName: fileName,
                                userId: userId,
                                uploadPath: uploadPath,
                                bucketName: bucketName,
                                processingDate: new Date().toISOString(),
                                documentType: 'math-homework',
                                source: 'mathpix-ocr-simple',
                                pageNumber: pageIndex + 1,
                                totalPages: mathpixResult.pages.length,
                                lineCount: pageLines.length,
                                boundingBoxes: pageLines
                                    .filter((line: any) => line.region)
                                    .map((line: any) => ({
                                        lineIndex: line.lineIndex,
                                        text: line.text,
                                        type: line.type,
                                        region: line.region,
                                        confidence: line.confidence
                                    })),
                                extractedLines: pageLines
                            }
                        };
                        documents.push(document);
                    }

                    return documents;
                } catch (error) {
                    console.error("Error creating LlamaIndex documents:", error);
                    return [];
                }
            };

            const key = process.env.MATHPIX_API_KEY;
            const appId = "paradigm_75df0a_93d146"

            const options = {
                "conversion_formats": { "md": true },
                "math_inline_delimiters": ["$", "$"],
                "rm_spaces": true
            }

            const fileContent = fs.createReadStream(tempFilePath);

            const formData = new FormData();
            formData.append("file", fileContent);
            formData.append("options_json", JSON.stringify(options));

            const response = await fetch("https://api.mathpix.com/v3/pdf", {
                method: "POST",
                headers: {
                    "app_id": appId,
                    "app_key": key ? key : ""
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Error uploading file to Mathpix API:", errorText);
                throw new Error(`Mathpix API error: ${response.status} ${response.statusText}`);
            }

            const data = (await response.json()) as MathpixResponse;
            const pdfId: string = data.pdf_id;

            if (pdfId) {
                const pollForCompletion = async (pdfId: string, retries = 20, delayMs = 500): Promise<MathpixResponse | null> => {
                    for (let i = 0; i < retries; i++) {
                        const response = await fetch(`https://api.mathpix.com/v3/pdf/${pdfId}.lines.json`, {
                            method: "GET",
                            headers: {
                                "app_id": appId,
                                "app_key": key ? key : ""
                            }
                        });

                        const data = (await response.json()) as MathpixResponse;

                        if (data.status === "completed") {
                            return data;
                        } else if (data.status === "error") {
                            console.error("Job failed with error:", data);
                            return null;
                        } else if (data.status === undefined) {
                            return data;
                        }

                        // Wait for the specified delay before the next attempt
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }

                    console.error("Job did not complete within the expected time.");
                    return null;
                };

                let llamaIndexResult: any[] | null = null;

                const result = await pollForCompletion(pdfId);

                const lines = Array.isArray(result?.pages) && result.pages.length > 0
                    ? result.pages[0].lines
                        .filter((line: any) => line && line.text !== "" && line.text != null && line.type != "table")
                        .map((line: any) => `Text at page 1: ${line.text}`)
                        .join('\n')
                    : '';

                if (result) {
                    if (result && Array.isArray(result.pages)) {
                        // Create LlamaIndex Documents from the OCR result
                        const documents = await createLlamaIndexDocuments(result, lines);

                        // Upload documents to LlamaIndex for embedding generation
                        llamaIndexResult = await uploadOCRAsFileToLlamaIndex(documents);

                        // If standard approach fails, try creating text files and uploading them
                        if (!llamaIndexResult) {
                            console.log('File upload failed, but continuing with document processing...');
                        }

                        // Wait for pipeline indexing to complete
                        let indexingCompleted = false;
                        if (llamaIndexResult) {
                            const pipelineId = "f60d5a9e-a5c9-4a23-98c4-379986f02020";
                            indexingCompleted = await waitForPipelineIndexingCompletion(pipelineId, 120000); // 2 minute timeout
                        }

                        // Store basic OCR data without question detection
                        const parsedJsonPath = uploadPath.replace(/\.pdf$/i, '_ocr.json');
                        const ocrData = {
                            pages: result.pages.map((page: any, pageIndex: number) => ({
                                pageNumber: pageIndex + 1,
                                lines: page.lines.map((line: any, lineIndex: number) => ({
                                    text: line.text,
                                    type: line.type,
                                    region: line.region,
                                    lineIndex: lineIndex
                                })),
                                pageWidth: page.page_width,
                                pageHeight: page.page_height
                            }))
                        };

                        const { error: uploadError } = await supabase.storage
                            .from(bucketName)
                            .upload(parsedJsonPath, JSON.stringify(ocrData), {
                                contentType: 'application/json',
                                upsert: true,
                            });

                        if (uploadError) {
                            console.error('Error uploading OCR JSON:', uploadError);
                            return NextResponse.json(
                                { error: `Failed to upload OCR JSON: ${uploadError.message}` },
                                { status: 500 }
                            );
                        }

                        // If we reach here, everything was successful
                        const processingEndTime = Date.now();
                        const processingTimeMs = processingEndTime - processingStartTime;

                        const uploadFinishData = {
                            fileName,
                            userId,
                            bucketName,
                            uploadPath,
                            documentsCreated: documents.length,
                            indexingCompleted,
                            ocrJsonPath: parsedJsonPath,
                            processingTimeMs
                        };

                        return NextResponse.json(
                            {
                                message: 'File parsed and uploaded successfully with Mathpix (simple mode)',
                                documentsCreated: documents.length,
                                llamaIndexUploaded: llamaIndexResult !== null,
                                indexingCompleted,
                                ocrJsonPath: parsedJsonPath,
                                uploadFinishData,
                                ocrMethod: 'mathpix-ocr-simple'
                            },
                            { status: 200 }
                        );
                    } else {
                        console.error("Result pages is not an array:", result);
                        return NextResponse.json(
                            { error: 'Invalid result structure: pages is not an array' },
                            { status: 500 }
                        );
                    }
                } else {
                    console.error("No result data received from Mathpix");
                    return NextResponse.json(
                        { error: 'No result data received from Mathpix' },
                        { status: 500 }
                    );
                }
            } else {
                console.error("Cannot proceed without a valid pdf_id.");
                return NextResponse.json(
                    { error: 'Failed to get valid PDF ID from Mathpix' },
                    { status: 500 }
                );
            }

        } catch (parseError) {
            // Clean up temporary files if they exist
            try {
                if (typeof tempFilePath !== 'undefined') {
                    await unlink(tempFilePath);
                }
            } catch (unlinkError) {
                console.error('Error cleaning up temp file:', unlinkError)
            }

            return NextResponse.json(
                {
                    error: `Failed to parse document: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
                    fileName
                },
                { status: 500 }
            )
        }

    } catch (error) {
        console.error('API route error:', error)
        return NextResponse.json(
            {
                error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`
            },
            { status: 500 }
        )
    }
}

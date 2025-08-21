import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeFile, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import fs from 'fs'
import FormData from 'form-data'
import { PDFDocument } from 'pdf-lib'
import fetch from 'node-fetch'

console.log('Processing nparse route...')

// Function to chunk PDF into segments of specified page count
const chunkPDF = async (pdfBuffer: Buffer, chunkSize: number = 15): Promise<Buffer[]> => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();
    const chunks: Buffer[] = [];
    
    console.log(`📄 Total pages in PDF: ${totalPages}`);
    console.log(`📑 Chunking into segments of ${chunkSize} pages`);
    
    for (let i = 0; i < totalPages; i += chunkSize) {
      const endPage = Math.min(i + chunkSize - 1, totalPages - 1);
      console.log(`📋 Creating chunk: pages ${i + 1} to ${endPage + 1}`);
      
      // Create new PDF document for this chunk
      const chunkDoc = await PDFDocument.create();
      
      // Copy pages to the chunk document
      const pageIndices = Array.from({ length: endPage - i + 1 }, (_, idx) => i + idx);
      const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndices);
      
      // Add copied pages to chunk document
      copiedPages.forEach((page) => chunkDoc.addPage(page));
      
      // Save chunk as buffer
      const chunkBytes = await chunkDoc.save();
      chunks.push(Buffer.from(chunkBytes));
    }
    
    console.log(`✅ Successfully created ${chunks.length} PDF chunks`);
    return chunks;
  } catch (error) {
    console.error('❌ Error chunking PDF:', error);
    throw new Error(`Failed to chunk PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Type definitions for LlamaIndex response
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
    totalPages?: number;
  };
}

// Function to wait for pipeline indexing completion using pipeline status API
const waitForPipelineIndexingCompletion = async (pipelineId: string, timeoutMs: number = 120000): Promise<boolean> => {
  const startTime = Date.now();
  const pollInterval = 3000; // Check every 3 seconds
    
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
  
  try {
    const { fileName, bucketName, uploadPath, userId } = await request.json()

    // Validate required fields
    if (!fileName || !bucketName || !uploadPath || !userId) {
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
        const tempFileName = fileName; // Use original filename without UUID
        tempFilePath = join(tmpdir(), tempFileName);
        await writeFile(tempFilePath, buffer);

        // Chunk the PDF into 15-page segments
        console.log('📄 Starting PDF chunking process...');
        const pdfChunks = await chunkPDF(buffer, 15);
        console.log(`✅ Created ${pdfChunks.length} PDF chunks`);

        if (pdfChunks.length === 0) {
            return NextResponse.json(
                { error: 'Failed to chunk PDF - no chunks created' },
                { status: 500 }
            );
        }

        // First, upload all PDF chunks to Google Cloud Storage
        const uploadChunksToGCS = async (pdfChunks: Buffer[]): Promise<string[]> => {
            try {
                console.log('� Uploading PDF chunks to Google Cloud Storage...');
                
                // Initialize Google Cloud Storage
                const { Storage } = require('@google-cloud/storage');
                const storage = new Storage({
                    keyFilename: '/Users/vpoddar/Documents/learnai/serviceaccount.json',
                    projectId: '39073705270'
                });

                const bucketName = 'paradigms-documents';
                const bucket = storage.bucket(bucketName);
                const uploadedUris: string[] = [];
                
                // Upload each chunk to GCS
                for (let i = 0; i < pdfChunks.length; i++) {
                    const chunkFileName = `${fileName.replace(/\.(pdf|doc|docx)$/i, '')}_chunk_${i + 1}.pdf`;
                    const file = bucket.file(`chunks/${userId}/${chunkFileName}`);
                    
                    console.log(`📤 Uploading chunk ${i + 1}/${pdfChunks.length}: ${chunkFileName}`);
                    
                    await file.save(pdfChunks[i], {
                        metadata: {
                            contentType: 'application/pdf',
                        },
                    });
                    
                    const gcsUri = `gs://${bucketName}/chunks/${userId}/${chunkFileName}`;
                    uploadedUris.push(gcsUri);
                    console.log(`✅ Uploaded chunk ${i + 1}: ${gcsUri}`);
                }
                
                console.log(`✅ Successfully uploaded ${uploadedUris.length} chunks to GCS`);
                return uploadedUris;
            } catch (error) {
                console.error('❌ Error uploading chunks to GCS:', error);
                throw error;
            }
        };

        // Process all chunks using Document AI batch processing
        const processBatchWithDocumentAI = async (gcsUris: string[]): Promise<any> => {
            try {
                console.log('🔄 Starting Document AI batch processing...');
                
                const projectId = '39073705270';
                const location = 'us';
                const processorId = '83aeafbc915376ac';
                const gcsOutputUri = 'paradigms-documents';
                const gcsOutputUriPrefix = `batch_output/${userId}/${fileName.replace(/\.(pdf|doc|docx)$/i, '')}`;

                // Initialize Document AI client
                const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
                const client = new DocumentProcessorServiceClient({
                    keyFilename: '/Users/vpoddar/Documents/learnai/serviceaccount.json'
                });

                const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

                // Configure the batch process request with all chunk URIs
                const documents = gcsUris.map(uri => ({
                    gcsUri: uri,
                    mimeType: 'application/pdf',
                }));

                const request = {
                    name,
                    inputDocuments: {
                        gcsDocuments: {
                            documents: documents,
                        },
                    },
                    documentOutputConfig: {
                        gcsOutputConfig: {
                            gcsUri: `gs://${gcsOutputUri}/${gcsOutputUriPrefix}/`,
                        },
                    },
                };

                console.log(`🔄 Processing ${documents.length} documents in batch...`);

                // Start batch processing operation
                const [operation] = await client.batchProcessDocuments(request);

                // Wait for operation to complete
                console.log('⏳ Waiting for batch processing to complete...');
                await operation.promise();
                console.log('✅ Document batch processing complete');

                // Download and process results
                const { Storage } = require('@google-cloud/storage');
                const storage = new Storage({
                    keyFilename: '/Users/vpoddar/Documents/learnai/serviceaccount.json',
                    projectId: projectId
                });

                const bucket = storage.bucket(gcsOutputUri);
                const [files] = await bucket.getFiles({ prefix: gcsOutputUriPrefix });

                console.log(`📥 Found ${files.length} result files, downloading...`);

                // Process results with concurrency control
                const { default: PQueue } = require('p-queue');
                const queue = new PQueue({ concurrency: 5 });
                const allResults: any[] = [];

                const downloadTasks = files.map((fileInfo: any, index: number) => async () => {
                    try {
                        const [file] = await fileInfo.download();
                        console.log(`📥 Processing result file ${index + 1}/${files.length}`);

                        const document = JSON.parse(file.toString());
                        const { text } = document;

                        // Extract text helper function
                        const getText = (textAnchor: any) => {
                            if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
                                return '';
                            }
                            const startIndex = textAnchor.textSegments[0].startIndex || 0;
                            const endIndex = textAnchor.textSegments[0].endIndex;
                            return text.substring(startIndex, endIndex);
                        };

                        // Extract entities with page information
                        const processedEntities: any[] = [];
                        if (document.pages) {
                            document.pages.forEach((page: any, pageIndex: number) => {
                                // Extract form fields
                                if (page.formFields) {
                                    page.formFields.forEach((field: any) => {
                                        const fieldName = getText(field.fieldName.textAnchor);
                                        const fieldValue = getText(field.fieldValue.textAnchor);
                                        
                                        if (fieldName.trim() || fieldValue.trim()) {
                                            processedEntities.push({
                                                type: 'form_field',
                                                name: fieldName,
                                                value: fieldValue,
                                                page: pageIndex
                                            });
                                        }
                                    });
                                }

                                // Extract text entities (if available)
                                if (page.entities) {
                                    page.entities.forEach((entity: any) => {
                                        processedEntities.push({
                                            type: entity.type || 'entity',
                                            name: entity.mentionText || getText(entity.textAnchor) || '',
                                            confidence: entity.confidence || 0,
                                            page: pageIndex,
                                            entityType: entity.type
                                        });
                                    });
                                }

                                // Extract tables
                                if (page.tables) {
                                    page.tables.forEach((table: any, tableIndex: number) => {
                                        processedEntities.push({
                                            type: 'table',
                                            name: `Table ${tableIndex + 1}`,
                                            rows: table.bodyRows ? table.bodyRows.length : 0,
                                            columns: table.headerRows && table.headerRows[0] ? table.headerRows[0].cells.length : 0,
                                            page: pageIndex
                                        });
                                    });
                                }

                                // Extract paragraphs
                                if (page.paragraphs) {
                                    page.paragraphs.forEach((paragraph: any, paragraphIndex: number) => {
                                        const paragraphText = getText(paragraph.layout.textAnchor);
                                        if (paragraphText.trim()) {
                                            processedEntities.push({
                                                type: 'paragraph',
                                                name: `Paragraph ${paragraphIndex + 1}`,
                                                text: paragraphText.substring(0, 100) + (paragraphText.length > 100 ? '...' : ''),
                                                fullText: paragraphText,
                                                page: pageIndex
                                            });
                                        }
                                    });
                                }

                                // Extract lines
                                if (page.lines) {
                                    page.lines.forEach((line: any, lineIndex: number) => {
                                        const lineText = getText(line.layout.textAnchor);
                                        if (lineText.trim()) {
                                            processedEntities.push({
                                                type: 'line',
                                                name: `Line ${lineIndex + 1}`,
                                                text: lineText,
                                                page: pageIndex
                                            });
                                        }
                                    });
                                }
                            });
                        }

                        // Extract document-level entities if available
                        if (document.entities) {
                            document.entities.forEach((entity: any) => {
                                processedEntities.push({
                                    type: entity.type || 'document_entity',
                                    name: entity.mentionText || '',
                                    confidence: entity.confidence || 0,
                                    page: -1, // Document level
                                    entityType: entity.type
                                });
                            });
                        }

                        return {
                            document: {
                                text: text,
                                pages: document.pages,
                                entities: processedEntities
                            },
                            fileIndex: index
                        };
                    } catch (error) {
                        console.error(`❌ Error processing result file ${index + 1}:`, error);
                        return null;
                    }
                });

                const results = await queue.addAll(downloadTasks);
                const validResults = results.filter((result: any) => result !== null);

                console.log(`✅ Successfully processed ${validResults.length}/${files.length} result files`);
                return validResults;

            } catch (error) {
                console.error('❌ Document AI batch processing error:', error);
                throw error;
            }
        };

        // Upload all PDF chunks to Google Cloud Storage first
        console.log('� Starting upload of PDF chunks to Google Cloud Storage...');
        const uploadedGcsUris = await uploadChunksToGCS(pdfChunks);

        if (uploadedGcsUris.length === 0) {
            return NextResponse.json(
                { error: 'Failed to upload any PDF chunks to Google Cloud Storage' },
                { status: 500 }
            );
        }

        console.log(`✅ Successfully uploaded ${uploadedGcsUris.length} chunks to GCS`);

        // Process all uploaded chunks using Document AI batch processing
        console.log('🔄 Starting Document AI batch processing...');
        const batchResults = await processBatchWithDocumentAI(uploadedGcsUris);

        if (!batchResults || batchResults.length === 0) {
            return NextResponse.json(
                { error: 'Failed to process any PDF chunks with Google Document AI batch processing' },
                { status: 500 }
            );
        }

                console.log(`✅ Successfully processed ${batchResults.length} documents with batch processing`);

        // Function to collect and organize all entity types
        const collectAndSaveEntityTypes = async (results: any[], fileName: string, supabase: any, userId: string): Promise<any> => {
            try {
                console.log('🔄 Collecting and organizing all entity types...');
                
                const entityCollection = {
                    metadata: {
                        originalFileName: fileName,
                        processingDate: new Date().toISOString(),
                        totalChunksProcessed: results.length,
                        userId: userId
                    },
                    entityTypes: {
                        bill_id: [],
                        congressional_session: [],
                        enacting_clause: [],
                        effective_date: [],
                        findings_purpose: [],
                        sponsor: [],
                        sunset_clause: [],
                        amendments_to_existing_law: [],
                        appropriations: [],
                        definitions: [],
                        implementation_enforcement: [],
                        provisions: [],
                        committee_references: [],
                        penalties: []
                    } as any,
                    entityTypesSummary: {} as any,
                    allEntitiesByPage: {} as any
                };

                // Collect all entities from all batch results (will be filtered to legislative types only)
                let allEntities: any[] = [];
                results.forEach((result: any, resultIndex: number) => {
                    if (result.document && result.document.entities) {
                        result.document.entities.forEach((entity: any) => {
                            allEntities.push({
                                ...entity,
                                chunkIndex: resultIndex,
                                originalChunk: resultIndex
                            });
                        });
                    }
                });

                // Define the allowed legislative entity types based on the document structure
                const allowedEntityTypes = [
                    'congressional_session', 
                    'enacting_clause',
                    'effective_date',
                    'findings_purpose',
                    'Sponsor',
                    'sunset_clause',
                    'amendments_to_existing_law',
                    'appropriations',
                    'definitions',
                    'implementation_enforcement',
                    'provisions',
                    'bill_id',
                    'committee_references',
                    'penalties',
                ];

                // Organize entities by type - only include allowed legislative types
                allEntities.forEach((entity: any) => {
                    const entityType = entity.type || 'unknown';
                    const entityName = entity.name || entity.text || entity.mentionText || '';
                    
                    // Only process entities that match our allowed legislative types AND have a non-blank name
                    if (allowedEntityTypes.includes(entityType) && entityName.trim() !== '') {
                        // Initialize array for this entity type if it doesn't exist
                        if (!entityCollection.entityTypes[entityType]) {
                            entityCollection.entityTypes[entityType] = [];
                        }
                        
                        // Add entity to the appropriate type array
                        entityCollection.entityTypes[entityType].push(entity);
                        
                        // Track by page
                        const pageKey = `page_${entity.page || 0}`;
                        if (!entityCollection.allEntitiesByPage[pageKey]) {
                            entityCollection.allEntitiesByPage[pageKey] = [];
                        }
                        entityCollection.allEntitiesByPage[pageKey].push(entity);
                    }
                });

                // Create summary of entity types
                Object.keys(entityCollection.entityTypes).forEach(type => {
                    entityCollection.entityTypesSummary[type] = {
                        count: entityCollection.entityTypes[type].length,
                        examples: entityCollection.entityTypes[type].slice(0, 3).map((entity: any) => ({
                            name: entity.name || entity.text || 'N/A',
                            page: entity.page || 0,
                            chunk: entity.chunkIndex || 0
                        }))
                    };
                });

                // Save entity collection to file
                const entityFileName = fileName.replace(/\.(pdf|doc|docx)$/i, '_extraction.json');
                const entityFilePath = join(entityFileName);
                
                await writeFile(entityFilePath, JSON.stringify(entityCollection, null, 2));
                console.log(`✅ Entity types collection saved to: ${entityFilePath}`);

                // Upload entity collection to Supabase Storage
                try {
                    const entityFileBuffer = await readFile(entityFilePath);
                    const supabaseEntityPath = `${userId}/${entityFileName}`;
                    
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('bill_info')
                        .upload(supabaseEntityPath, entityFileBuffer, {
                            contentType: 'application/json',
                            upsert: true
                        });

                    if (uploadError) {
                        console.error('❌ Error uploading entity collection to Supabase:', uploadError);
                    } else {
                        console.log(`✅ Entity collection uploaded to Supabase Storage: bill_info/${supabaseEntityPath}`);
                    }
                } catch (uploadError) {
                    console.error('❌ Error uploading entity collection to Supabase:', uploadError);
                }

                return {
                    entityCollection,
                    entityFilePath,
                    entityFileName,
                    totalEntityTypes: Object.keys(entityCollection.entityTypes).length,
                    totalEntities: allEntities.length
                };

            } catch (error) {
                console.error('❌ Error collecting entity types:', error);
                throw error;
            }
        };

        // Collect all entity types into a single file
        const entityTypesResult = await collectAndSaveEntityTypes(batchResults, fileName, supabase, userId);
        console.log(`✅ Collected ${entityTypesResult.totalEntityTypes} different entity types with ${entityTypesResult.totalEntities} total entities`);

        // Combine results from all batch processed documents

        // must occur once
        let combinedText = '';
        let billId = '';
        let congressionalSession = '';
        let enactingClause = '';
        let effectiveDate = '';
        let findingsPurpose = '';
        let sponsor = [{name: '', party: '', state: ''}];
        let sunset_clause = '';
        let notes = '';

        //can occur multiple times
        let amendments_to_existing_law= [{lawReference: '', modification: ''}];
        let appropriations = [{amount: '', purpose: ''}];
        let definitions = [{term: '', meaning: ''}];
        let implementationEnforcement = {
            agency: '',
            penalties: '',
            responsibilities: ''
        };
        let provisions = [{heading: '', sectionNumber: '', text: ''}];
        let miscellaneous = '';
        
        let combinedPages: any[] = [];
        let combinedEntities: any[] = [];
        let totalPageOffset = 0;

        batchResults.forEach((result: any, resultIndex: number) => {
            if (result.document && result.document.text) {
                combinedText += result.document.text + '\n\n';
            }

            if (result.document && result.document.pages) {
                combinedPages = combinedPages.concat(result.document.pages);
            }

            if (result.document && result.document.entities) {
                // Adjust page references for entities to account for document offset
                const adjustedEntities = result.document.entities.map((entity: any) => ({
                    ...entity,
                    pageOffset: totalPageOffset,
                    documentIndex: resultIndex
                }));
                combinedEntities = combinedEntities.concat(adjustedEntities);
            }

            // Update page offset for next document
            if (result.document && result.document.pages) {
                totalPageOffset += result.document.pages.length;
            }
        });

        // Create combined document result
        const documentAIResult = {
            document: {
                text: combinedText.trim(),
                pages: combinedPages,
                entities: combinedEntities
            }
        };

      // Upload processed text to LlamaIndex
        const uploadToLlamaIndex = async (documentText: string): Promise<any | null> => {
            try {
                // Create a temporary text file with the OCR results
                const textFileName = fileName.replace(/\.(pdf|doc|docx)$/i, '_ocr.txt');
                const textFilePath = join(tmpdir(), textFileName);
                await writeFile(textFilePath, documentText);

                const fileFormData = new FormData();
                const fileStream = fs.createReadStream(textFilePath);

                fileFormData.append("upload_file", fileStream);
                fileFormData.append("external_file_id", `${fileName}_gemini_ocr_${Date.now()}`);
                fileFormData.append("project_id", "2a2234b3-7c0c-4436-b09c-db61e7e5b546");
                fileFormData.append("pipeline_id", "f159f09f-bb0c-4414-aaeb-084c8167cdf1");

                // Use node-fetch for Node.js stream compatibility
                const fileUploadResponse = await fetch("https://api.cloud.llamaindex.ai/api/v1/files", {
                    method: "POST",
                    headers: {
                        ...fileFormData.getHeaders(),
                        "Accept": "application/json",
                        "Authorization": `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`
                    },
                    body: fileFormData
                });

                // Clean up temporary text file
                await unlink(textFilePath);

                if (!fileUploadResponse.ok) {
                    const errorText = await fileUploadResponse.text();
                    console.error('❌ File upload failed:', {
                        status: fileUploadResponse.status,
                        statusText: fileUploadResponse.statusText,
                        errorText
                    });
                    return null;
                }

                const fileResult = await fileUploadResponse.json() as { id?: string;[key: string]: any };

                // Add the file to the pipeline if it has an ID
                if (fileResult && fileResult.id) {
                    try {
                        const addToPipelineResponse = await fetch(`https://api.cloud.llamaindex.ai/api/v1/pipelines/f159f09f-bb0c-4414-aaeb-084c8167cdf1/files`, {
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
                                    documentType: 'document-gemini-ocr',
                                    source: 'google-document-ai'
                                }
                            }])
                        });

                        if (!addToPipelineResponse.ok) {
                            const errorText = await addToPipelineResponse.text();
                            console.error('❌ Pipeline addition failed:', errorText);
                        }

                    } catch (pipelineError) {
                        console.error("Pipeline addition failed:", pipelineError);
                    }
                }

                return fileResult;
            } catch (error) {
                console.error("File upload error:", error);
                return null;
            }
        };

        if (!documentAIResult) {
            return NextResponse.json(
            { error: 'Failed to process document with Google Document AI' },
            { status: 500 }
            );
        }

        // Extract text from Document AI response
        const extractedText = documentAIResult.document?.text || '';

        if (!extractedText.trim()) {
            return NextResponse.json(
            { error: 'No text extracted from document' },
            { status: 500 }
            );
        }

        // Upload extracted text to LlamaIndex for processing
        const llamaIndexResult = await uploadToLlamaIndex(extractedText);

        if (!llamaIndexResult) {
            return NextResponse.json(
            { error: 'Failed to upload file to LlamaIndex' },
            { status: 500 }
            );
        }

        let indexingCompleted = false;
        if (llamaIndexResult) {
            const pipelineId = "f159f09f-bb0c-4414-aaeb-084c8167cdf1";
            indexingCompleted = await waitForPipelineIndexingCompletion(pipelineId, 120000); // 2 minute timeout
        }

        // Clean up temporary file
        if (tempFilePath) {
            await unlink(tempFilePath);
        }

        // If we reach here, everything was successful
        const processingEndTime = Date.now();
        const processingTimeMs = processingEndTime - processingStartTime;
        
        const uploadFinishData = {
            fileName,
            userId,
            bucketName,
            uploadPath,
            documentsCreated: 1,
            indexingCompleted,
            processingTimeMs,
            ocrMethod: 'gemini-ocr-batch-processing',
            chunksProcessed: batchResults.length,
            totalChunks: pdfChunks.length,
            gcsUrisUploaded: uploadedGcsUris.length,
            entityTypesCollected: entityTypesResult.totalEntityTypes,
            totalEntitiesExtracted: entityTypesResult.totalEntities,
            entityTypesFile: entityTypesResult.entityFileName
        };

        return NextResponse.json(
            { 
            message: `File parsed and uploaded successfully with Google Document AI (Batch Processing) - Processed ${batchResults.length}/${pdfChunks.length} chunks and extracted ${entityTypesResult.totalEntityTypes} entity types`,
            documentsCreated: 1,
            llamaIndexUploaded: true,
            indexingCompleted,
            uploadFinishData,
            ocrMethod: 'gemini-ocr-batch-processing',
            chunksProcessed: batchResults.length,
            totalChunks: pdfChunks.length,
            gcsUrisUploaded: uploadedGcsUris.length,
            entityTypesCollection: {
                fileName: entityTypesResult.entityFileName,
                filePath: entityTypesResult.entityFilePath,
                totalEntityTypes: entityTypesResult.totalEntityTypes,
                totalEntities: entityTypesResult.totalEntities,
                entityTypesSummary: entityTypesResult.entityCollection.entityTypesSummary
            }
            },
            { status: 200 }
        );

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

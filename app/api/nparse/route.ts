import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import fs from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { GoogleAuth } from 'google-auth-library'

console.log('Processing nparse route...')

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

        // Process document with Google Document AI (Gemini OCR)
        const processWithDocumentAI = async (): Promise<any> => {
            try {
            // Authenticate using service account
            const auth = new GoogleAuth({
                keyFile: '/Users/vpoddar/Documents/learnai/serviceaccount.json',
                scopes: 'https://www.googleapis.com/auth/cloud-platform'
            });
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();

            if (!accessToken.token) {
                console.error('❌ Failed to get access token');
                return null;
            }

            // Read the file as base64
            const fileBuffer = await fs.promises.readFile(tempFilePath!);
            const base64Content = fileBuffer.toString('base64');

            const requestBody = {       
                    "rawDocument": {
                    "mimeType": "application/pdf",
                        "content": base64Content
                },
            };

            const response = await fetch(
                'https://us-documentai.googleapis.com/v1/projects/39073705270/locations/us/processors/1ef30fee3f5f7c68:process',
                {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Document AI processing failed:', {
                status: response.status,
                statusText: response.statusText,
                errorText
                });
                return null;
            }

            const result = await response.json() as any;

            return result;

        } catch (error) {
            console.error("Document AI processing error:", error);
            return null;
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

          const fileUploadResponse = await fetch("https://api.cloud.llamaindex.ai/api/v1/files", {
            method: "POST",
            headers: {
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

          const fileResult = await fileUploadResponse.json() as { id?: string; [key: string]: any };
          
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

        // Process document with Google Document AI first
        const documentAIResult = await processWithDocumentAI();

        let parsedJson: { page: { lines: any[]; pageWidth: any; pageHeight: any }[] } = {
            page: []
        };

        const llmData = documentAIResult.document
        const entities = llmData.entities;

        llmData.pages.forEach((page: any, pageIndex: any) => {
            parsedJson.page.push({ lines: [], pageWidth: page.dimension.width, pageHeight: page.dimension.height });
        })

        entities.forEach((page:any, pageIndex:any) => {
            const pageWidth = parsedJson.page[pageIndex].pageWidth;
            const pageHeight = parsedJson.page[pageIndex].pageHeight;
            page.properties.forEach((entity:any, entityIndex:any) => {
                const vertices = entity.pageAnchor.pageRefs[0].boundingPoly.normalizedVertices;
                const topLeft = vertices[0];
                const bottomRight = vertices[2];


                parsedJson.page[pageIndex].lines.push({
                    "text": entity.mentionText,
                    "type": "text",
                    "textType": "Q",
                    "region": {
                        "top_left_x": Math.round(topLeft.x * pageWidth),
                        "top_left_y": Math.round(topLeft.y * pageHeight),
                        "width": Math.round((bottomRight.x - topLeft.x) * pageWidth),
                        "height": Math.round((bottomRight.y - topLeft.y) * pageHeight)
                    },
                    "line": entityIndex,
                });
            });
        });

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

        // Wait for pipeline indexing to complete
        let indexingCompleted = false;
        if (llamaIndexResult) {
            const pipelineId = "f159f09f-bb0c-4414-aaeb-084c8167cdf1";
            indexingCompleted = await waitForPipelineIndexingCompletion(pipelineId, 120000); // 2 minute timeout
        }

        // Upload parsedJson as a JSON file to the same bucket for consistency
        const parsedJsonPath = uploadPath.replace(/\.(pdf|doc|docx)$/i, '_parsed.json');
        const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(parsedJsonPath, JSON.stringify(parsedJson), {
            contentType: 'application/json',
            upsert: true,
            });

        if (uploadError) {
            console.error('Error uploading parsed JSON:', uploadError);
            return NextResponse.json(
            { error: `Failed to upload parsed JSON: ${uploadError.message}` },
            { status: 500 }
            );
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
            parsedJsonPath,
            processingTimeMs,
            ocrMethod: 'gemini-ocr'
        };

        return NextResponse.json(
            { 
            message: 'File parsed and uploaded successfully with Google Document AI (Gemini OCR)',
            documentsCreated: 1,
            llamaIndexUploaded: true,
            indexingCompleted,
            parsedJsonPath,
            uploadFinishData,
            ocrMethod: 'gemini-ocr'
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

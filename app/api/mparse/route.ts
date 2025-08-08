import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import fs from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { GoogleGenAI } from "@google/genai";

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
  column?: string;
}

interface MathpixPage {
  lines: MathpixLine[];
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
  const pollInterval = 250; // Check every 3 seconds
  
  console.log(`🔍 Polling pipeline status for indexing completion: ${pipelineId}`);
  
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
        
        console.log(`📊 Pipeline status:`, {
          status: status.status,
          totalDocuments: status.total_documents || 0,
          indexedDocuments: status.indexed_documents || 0,
          pendingDocuments: status.pending_documents || 0,
          failedDocuments: status.failed_documents || 0
        });

        // Check if indexing is complete
        if (status.status === 'SUCCESS' || status.status === 'completed') {
          console.log(`✅ Pipeline indexing completed with status: ${status.status}`);
          return true;
        } else if (status.status === 'failed' || status.status === 'error') {
          console.log(`❌ Pipeline indexing failed with status: ${status.status}`);
          return false;
        } else if (status.pending_documents === 0 && status.indexed_documents > 0) {
          // Alternative check: no pending documents and some indexed
          console.log(`✅ Pipeline indexing completed - no pending documents remaining`);
          return true;
        } else {
          console.log(`⏳ Pipeline still indexing - status: ${status.status}, pending: ${status.pending_documents || 0}`);
        }
      } else {
        console.log(`⚠️ Error checking pipeline status: ${statusResponse.status} ${statusResponse.statusText}`);
        const errorText = await statusResponse.text();
        console.log(`Error details: ${errorText}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      console.error('❌ Error polling pipeline status:', error);
      // Continue polling despite errors
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  console.log(`⏰ Pipeline indexing poll timeout after ${timeoutMs}ms for pipeline: ${pipelineId}`);
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

      // Create function to upload OCR content as a file to LlamaIndex
      const uploadOCRAsFileToLlamaIndex = async (documents: LlamaIndexDocument[]): Promise<any | null> => {
        try {
          console.log(`🔄 Creating text file from ${documents.length} OCR documents for LlamaIndex upload...`);
          
          // Create a comprehensive text file with all OCR content and metadata
          const allText = documents.map(doc => {
            const metadata = `
            ${doc.text}
            `;
            return metadata;
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
          fileFormData.append("pipeline_id", "f159f09f-bb0c-4414-aaeb-084c8167cdf1");

          console.log(`📤 Uploading OCR text file to LlamaIndex...`);

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

          const fileResult = await fileUploadResponse.json() as { id?: string; [key: string]: any };
          console.log('✅ OCR text file upload successful:', fileResult);
          
          // Add the file to the pipeline if it has an ID
          if (fileResult && fileResult.id) {
            console.log('🔗 Adding OCR file to pipeline...');
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
                    documentType: 'math-homework-ocr',
                    source: 'mathpix-ocr-processed',
                    totalPages: documents.length,
                    totalBoundingBoxes: documents.reduce((sum, doc) => sum + doc.metadata.boundingBoxes.length, 0)
                  }
                }])
              });

              if (addToPipelineResponse.ok) {
                const pipelineResult = await addToPipelineResponse.json();
                console.log("✅ OCR file successfully added to pipeline:", pipelineResult);
              } else {
                const errorText = await addToPipelineResponse.text();
                console.error("❌ Error adding OCR file to pipeline:", errorText);
              }
            } catch (pipelineError) {
              console.error("❌ Pipeline addition failed:", pipelineError);
            }
          }
          
          // Clean up temp file
          await unlink(textFilePath);
          
          return fileResult;
        } catch (error) {
          console.error("❌ OCR file upload error:", error);
          return null;
        }
      };

      // Create LlamaIndex Documents from OCR output with metadata
      const createLlamaIndexDocuments = async (mathpixResult: MathpixResponse, lines: string): Promise<LlamaIndexDocument[]> => {
        try {
          console.log('🔧 Creating LlamaIndex Documents from OCR output...');
          
          if (!mathpixResult || !Array.isArray(mathpixResult.pages)) {
            throw new Error('Invalid Mathpix result structure');
          }

          console.log(`📄 Processing ${mathpixResult.pages.length} pages from Mathpix result`);
          const documents: LlamaIndexDocument[] = [];

          // Create a document for each page with detailed metadata
          for (let pageIndex = 0; pageIndex < mathpixResult.pages.length; pageIndex++) {
            const page = mathpixResult.pages[pageIndex];
            
            if (!Array.isArray(page.lines)) {
              console.log(`⚠️ Skipping page ${pageIndex + 1}: no lines array`);
              continue;
            }

            console.log(`📝 Processing page ${pageIndex + 1} with ${page.lines.length} lines`);

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
              console.log(`⚠️ Skipping page ${pageIndex + 1}: no text content`);
              continue;
            }

            console.log(`📊 Page ${pageIndex + 1} stats:`, {
              totalLines: pageLines.length,
              textLength: pageText.length,
              boundingBoxes: pageLines.filter(line => line.region).length
            });
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
                source: 'mathpix-ocr',
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
            console.log(`✅ Created document for page ${pageIndex + 1}`);
          }

          console.log(`🎉 Successfully created ${documents.length} LlamaIndex documents`);
          return documents;
        } catch (error) {
          console.error("❌ Error creating LlamaIndex documents:", error);
          return [];
        }
      };

      // Start document creation (will process after OCR completion)

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

      let mdData = "";

      if (pdfId) {
        const pollForCompletion = async (pdfId: string, retries = 20, delayMs = 500): Promise<MathpixResponse | null> => {
          for (let i = 0; i < retries; i++) {
            //console.log(`Polling attempt ${i + 1}...`);
            const response = await fetch(`https://api.mathpix.com/v3/pdf/${pdfId}.lines.json`, {
              method: "GET",
              headers: {
                "app_id": appId,
                "app_key": key ? key : ""
              }
            });

            const data = (await response.json()) as MathpixResponse;

            if (data.status === "completed") {
              return data; // Return the completed data
            } else if (data.status === "error") {
              console.error("Job failed with error:", data);
              return null;
            } else if (data.status === undefined) {

              // console.log(pdfId)

              // const url = `https://api.mathpix.com/v3/pdf/${pdfId}.mmd`;
              // const response = await fetch(url, {
              //   headers: {
              //     "app_id": "paradigm_75df0a_93d146",
              //     "app_key": `Bearer ${process.env.MATHPIX_API_KEY}`
              //   },
              // });

              // console.log("RESPONSE TEXT: ", response.text);
              // mdData = await response.text();
              return data;
            } else {
              //console.log("Job not completed yet. Current status:", data.status);
            }

            // Wait for the specified delay before the next attempt
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          console.error("Job did not complete within the expected time.");
          return null;
        };

        let parsedData: MathpixResponse;
        let llamaIndexResult: any[] | null = null; // Initialize for scope access

        const result = await pollForCompletion(pdfId);

        const lines = (result?.pages ?? []).flatMap((page) => {
          if (Array.isArray(page.lines)) {
            return page.lines.map((line: any) => {
              if (line && line.text !== "" && line.text != null && line.type != "table") {
                return `${line.text}`;
              }
              return undefined;
            }).filter(Boolean);
          }
          return [];
        }).join('\n')

        //console.log(result)
        if (result) {
          parsedData = result;

          if (result && Array.isArray(result.pages)) {
            // Create LlamaIndex Documents from the OCR result
            const documents = await createLlamaIndexDocuments(result, lines);
            console.log(`📚 Created ${documents.length} LlamaIndex documents`);

            // Upload documents to LlamaIndex for embedding generation
            llamaIndexResult = await uploadOCRAsFileToLlamaIndex(documents);
            console.log('🎯 LlamaIndex embedding result:', {
              success: llamaIndexResult !== null,
              fileUploaded: llamaIndexResult !== null,
              totalDocuments: documents.length
            });

            // If standard approach fails, try creating text files and uploading them
            if (!llamaIndexResult) {
              console.log('⚠️ File upload failed, but continuing with document processing...');
            }

            // Wait for pipeline indexing to complete
            let indexingCompleted = false;
            if (llamaIndexResult) {
              console.log('⏳ Waiting for pipeline indexing to complete...');
              const pipelineId = "f159f09f-bb0c-4414-aaeb-084c8167cdf1";
              indexingCompleted = await waitForPipelineIndexingCompletion(pipelineId, 120000); // 2 minute timeout
              
              if (indexingCompleted) {
                console.log('✅ Pipeline indexing completed successfully!');
              } else {
                console.log('⚠️ Pipeline indexing timeout - may still be processing in background');
              }
            }

            const formattedLines = result.pages.flatMap((page, pageIndex) => {
              if (Array.isArray(page.lines)) {
                return page.lines.map((line: any, lineIndex: any) => {
                  if (line && line.text !== "" && line.text != null && line.type != "table") {
                    return `Page ${pageIndex}, Item #${lineIndex}: ${line.text}`;
                  }
                  return undefined;
                }).filter(Boolean);
              }
              return [];
            });

            const linesForLLM = formattedLines.join('\n');
            console.log(linesForLLM)
            
            // Declare parsedJsonPath for use across scopes
            let parsedJsonPath: string;

            const systemPrompt = `
            You are a helpful assistant.Your task is to analyze a list of items extracted from a math homework document of a school student. Follow these steps: \n
            1. ** Determine Joining **: First, decide if any items should be joined together because they are part of the same logical statement or context (e.g., split across multiple lines). If so, merge them into a group. \n
            Do not treat answer choices (e.g., A, B, C, D) as separate groups by themselves. Instead, always include answer choices in the same group as their corresponding question.\n
            2. **Categorize Each Item**: For each group, determine its category:\n
              - **Q**: The group requires input or action from the reader, most commonly a question.\n
              - **R**: The group is relevant information needed to solve a question but does not itself require action. \n
              - **I**: The group is irrelevant or does not contribute to solving the problem.           
            `;

            const ai = new GoogleGenAI({
              apiKey: process.env.GEMINI_API_KEY
            });

            console.log('linesForLLM:', linesForLLM); 
            try {
              const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Here is the list of items:\n${linesForLLM}\n\nPlease analyze the items and provide your response.`,
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "array",
                    items: {
                      type: "array",
                      description: "The page of the item group.",
                      items: {
                        type: "array",
                        items: {
                          type: "string",
                          description: "The list of joined groups by their Item #, followed by the category string ('Q', 'R', or 'I'). Example: [[0,1,Q], [2,3,R], [4,I]]"
                        }
                      }
                    },
                  },
                  systemInstruction: systemPrompt,
                  thinkingConfig: {
                    thinkingBudget: 0, // Disables thinking
                  },
                }
              });

              console.log('LLM response:', JSON.stringify(response, null, 2));

              let llmData;
              try {
                llmData = JSON.parse(
                  response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
                );
              } catch (e) {
                console.error("Failed to parse LLM response:", e, response);
                llmData = {};
              }

              type ParsedLine = {
                text: string;
                type: string;
                textType: string;
                region: any;
                line: string;
                column: string;
              };

              type ParsedPage = {
                lines: ParsedLine[];
              };

              const parsedJson: { page: ParsedPage[] } = {
                page: []
              };

              // Extract pages and joinedGroups
              const joinedGroups = llmData;

              const mergeBoundingBoxes = (regions: any) => {
                if (!regions || regions.length === 0) return null;

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                regions.forEach((region:any) => {
                  const x = region.top_left_x;
                  const y = region.top_left_y;
                  const width = region.width;
                  const height = region.height;

                  minX = Math.min(minX, x);
                  minY = Math.min(minY, y);
                  maxX = Math.max(maxX, x + width);
                  maxY = Math.max(maxY, y + height);
                });

                return {
                  region: {
                    top_left_x: minX,
                    top_left_y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                  }
                };
              };

              joinedGroups.forEach((page:any, pageIndex:any) => {
                const currentPage = pageIndex;
                parsedJson.page.push({ lines: [] });
                page.forEach((group:any) => {
                  const textType = group[group.length - 1];
                  let mergedText = "";
                  const type = parsedData.pages?.[pageIndex]?.lines?.[group[0]]?.type || 'text';
                  const regionsArray = [];
                  const column = parsedData.pages?.[pageIndex]?.lines?.[group[0]]?.column || '';
                  const line = parsedData.pages?.[pageIndex]?.lines?.[group[0]]?.line || '';
                  for (let i = 0; i < group.length - 1; i++) {
                    const lineText = parsedData.pages?.[pageIndex]?.lines?.[group[i]]?.text || '';
                    mergedText += lineText + " ";
                    const region = parsedData.pages?.[pageIndex]?.lines?.[group[i]]?.region;
                    if (region) regionsArray.push(region);
                  }
                  parsedJson.page[currentPage].lines.push({
                    "text": mergedText.trim(),
                    "type": type,
                    "textType": textType,
                    "region": mergeBoundingBoxes(regionsArray),
                    "line": line,
                    "column": column
                  });
                })
              })

                //console.log(JSON.stringify(parsedJson, null, 2));

                // Upload parsedJson as a JSON file to the same bucket
                parsedJsonPath = uploadPath.replace(/\.pdf$/i, '_parsed.json');
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
              
            } catch (llmError) {
              console.error("LLM API error:", llmError);
              return NextResponse.json(
                { error: `LLM API error: ${llmError instanceof Error ? llmError.message : 'Unknown LLM error'}` },
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
              parsedJsonPath: parsedJsonPath!,
              processingTimeMs
            };

            // Log completion
            console.log('🎉 Upload and indexing process completed:', uploadFinishData);

            return NextResponse.json(
              { 
                message: 'File parsed and uploaded successfully',
                documentsCreated: documents.length,
                llamaIndexUploaded: llamaIndexResult !== null,
                indexingCompleted,
                parsedJsonPath: parsedJsonPath,
                uploadFinishData
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

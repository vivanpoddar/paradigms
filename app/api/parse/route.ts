import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import fs from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { GoogleGenAI } from "@google/genai";
import { readFile } from 'fs/promises';

export async function POST(request: NextRequest) {
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
    let parsedTempFilePath: string | undefined = undefined;

    try {
      // Convert blob to buffer and write to temporary file
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Create a temporary file for the uploaded PDF
      const tempFileName = fileName; // Use original filename without UUID
      tempFilePath = join(tmpdir(), tempFileName);
      await writeFile(tempFilePath, buffer);

      // Create function to add text to LlamaIndex for embedding
      const addTextToLlamaIndex = async (extractedText: string) => {
        try {
          console.log('Adding extracted text to LlamaIndex for embedding...');
          
          const response = await fetch("https://api.cloud.llamaindex.ai/api/v1/documents", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Authorization": `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`
            },
            body: JSON.stringify({
              text: extractedText,
              metadata: {
                fileName: fileName,
                userId: userId,
                uploadPath: uploadPath,
                bucketName: bucketName,
                processingDate: new Date().toISOString(),
                documentType: 'math-homework',
                source: 'mathpix-ocr'
              },
              project_id: "2a2234b3-7c0c-4436-b09c-db61e7e5b546",
              pipeline_id: "f159f09f-bb0c-4414-aaeb-084c8167cdf1"
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Error adding text to LlamaIndex:", errorText);
            throw new Error(`LlamaIndex text upload error: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();
          console.log("✅ Text successfully added to LlamaIndex:");
          console.log(JSON.stringify(result, null, 2));
          return result;
        } catch (error) {
          console.error("LlamaIndex text upload error:", error);
          return null;
        }
      };

      // Upload PDF to LlamaIndex in parallel with Mathpix processing
      const uploadToLlamaIndex = async () => {
        try {
          console.log('Uploading PDF to LlamaIndex...');
          
          if (!tempFilePath) {
            throw new Error('Temp file path not available');
          }
          
          const llamaFormData = new FormData();
          const fileStream = fs.createReadStream(tempFilePath);
          
          llamaFormData.append("upload_file", fileStream);
          llamaFormData.append("external_file_id", fileName);
          llamaFormData.append("project_id", "2a2234b3-7c0c-4436-b09c-db61e7e5b546");
          llamaFormData.append("pipeline_id", "f159f09f-bb0c-4414-aaeb-084c8167cdf1"); 

          const llamaResponse = await fetch("https://api.cloud.llamaindex.ai/api/v1/files", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Authorization": `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`
            },
            body: llamaFormData
          });

          if (!llamaResponse.ok) {
            const errorText = await llamaResponse.text();
            console.error("Error uploading file to LlamaIndex API:", errorText);
            throw new Error(`LlamaIndex API error: ${llamaResponse.status} ${llamaResponse.statusText}`);
          }

          const llamaResult = await llamaResponse.json() as { id?: string; [key: string]: any };
          console.log("=== FULL LLAMAINDEX RESPONSE ===");
          console.log(JSON.stringify(llamaResult, null, 2));
          console.log("=== END LLAMAINDEX RESPONSE ===");

          if (llamaResult && llamaResult.id) {
            console.log('Adding file to paradigms pipeline...');
            try {
              const addToPipelineResponse = await fetch(`https://api.cloud.llamaindex.ai/api/v1/pipelines/f159f09f-bb0c-4414-aaeb-084c8167cdf1/files`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "Accept": "application/json",
                  "Authorization": `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`
                },
                body: JSON.stringify([{
                  file_id: llamaResult.id,
                  custom_metadata: {
                    fileName: fileName,
                    userId: userId,
                    uploadPath: uploadPath,
                    bucketName: bucketName,
                    processingDate: new Date().toISOString(),
                    documentType: 'math-homework'
                  }
                }])
              });

              if (addToPipelineResponse.ok) {
                const pipelineResult = await addToPipelineResponse.json();
                console.log("✅ File successfully added to paradigms pipeline:");
                console.log(JSON.stringify(pipelineResult, null, 2));
              } else {
                const errorText = await addToPipelineResponse.text();
                console.error("❌ Error adding file to pipeline:", errorText);
              }
            } catch (pipelineError) {
              console.error("❌ Pipeline addition failed:", pipelineError);
            }
          }

          return llamaResult;
        } catch (error) {
          console.error("LlamaIndex upload error:", error);
          // Don't fail the entire process if LlamaIndex upload fails
          return null;
        }
      };

      // Start LlamaIndex upload in parallel
      const llamaUploadPromise = uploadToLlamaIndex();

      let key = process.env.MATHPIX_API_KEY;
      let appId = "paradigm_75df0a_93d146"

      let options = {
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

      type MathpixResponse = {
        pdf_id: string;
        status?: string;
        [key: string]: any;
      };

      const data = (await response.json()) as MathpixResponse;
      const pdfId: string = data.pdf_id;

      if (pdfId) {
        const pollForCompletion = async (pdfId: string, retries = 20, delayMs = 500): Promise<MathpixResponse | null> => {
          for (let i = 0; i < retries; i++) {
            console.log(`Polling attempt ${i + 1}...`);
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
              console.log("Job status is undefined. Printing final result...");
              return data;
            } else {
              console.log("Job not completed yet. Current status:", data.status);
            }

            // Wait for the specified delay before the next attempt
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          console.error("Job did not complete within the expected time.");
          return null;
        };

        let parsedData;
        let llamaIndexResult = null; // Initialize for scope access

        const result = await pollForCompletion(pdfId);
        console.log(result)
        if (result) {
          parsedData = result;

          if (result && Array.isArray(result.pages)) {
            // Extract all text from Mathpix result for LlamaIndex embedding
            const extractedText = result.pages.map((page: any, pageIndex: number) => {
              if (Array.isArray(page.lines)) {
                const pageText = page.lines.map((line: any) => line.text).join(' ');
                return `Page ${pageIndex + 1}: ${pageText}`;
              }
              return '';
            }).join('\n\n');

            console.log('Extracted text for LlamaIndex:', extractedText);

            // Add extracted text to LlamaIndex for embedding generation
            llamaIndexResult = await addTextToLlamaIndex(extractedText);
            console.log('LlamaIndex embedding result:', llamaIndexResult ? 'Success' : 'Failed');

            const formattedLines = result.pages.flatMap((page: any, pageIndex: number) => {
              let itemCount = 0;
              if (Array.isArray(page.lines)) {
                return page.lines.map((line: any, lineIndex: number) => {
                  const formattedLine = `Page ${pageIndex}, Item ${itemCount} | ${line.text} | Line ${line.line}, Column ${line.column}`;
                  itemCount++;
                  return formattedLine;
                });
              }
              return [];
            });

            const linesForLLM = formattedLines.join('\n');
            
            // Declare parsedJsonPath for use across scopes
            let parsedJsonPath: string;

            const systemPrompt = `
            You are a helpful assistant.Your task is to analyze a list of items extracted from a math homework document of a school student. Follow these steps: \n
            1. ** Determine Joining **: First, decide if any items should be joined together because they are part of the same logical statement or context (e.g., split across multiple lines). If so, merge them into a single item.\n
            2. **Categorize Each Item**: For each group, determine its category:\n
              - **Q**: The group is a question that requires input or action from the reader. A line of text including a mathematical expression is most likely part of a question.\n
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
                    type: "object",
                    properties: {
                      page: {
                        type: "array",
                        description: "Array of page objects, each representing a page in the document.",
                        items: {
                          type: "object",
                          properties: {
                            joinedGroups: {
                              type: "array",
                              items: {
                                type: "array",
                                items: {
                                  type: "string",
                                  description: "Item Number"
                                },
                              },
                              description: "A group of items of the same logical statement or context (e.g., ['0','1'], ['3'], or ['4','5','6'])."
                            },
                            category: {
                              type: "array",
                              items: {
                                type: "string",
                                enum: ["Q", "R", "I"],
                                description: "Q for question or mathematical expression, R for relevant info, I for irrelevant"
                              }
                            }
                          },
                          required: ["joinedGroups", "category"],
                          description: "Contains the joined groups and their categories for each page."
                        }
                      }
                    },
                    required: ["page"]
                  },
                  systemInstruction: systemPrompt,
                  thinkingConfig: {
                    thinkingBudget: 0, // Disables thinking
                  },
                }
              });

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

              let parsedJson: { page: ParsedPage[] } = {
                page: []
              };

              // Extract pages and joinedGroups
              console.log(parsedData)
              const pages = parsedData.pages;
              const joinedGroups = llmData.page;

              let mergeBoundingBoxes = (regions: any) => {
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
                let currentPage = pageIndex
                parsedJson.page.push({ lines: [] });
                page.joinedGroups.forEach((joinedGroup:any, lineIndex:any) => {
                  let mergedText = "";
                  let type = ""
                  let textType = "";
                  let regionsArray = [];
                  let column = "";
                  let line = "";
                  for (let groupIndex = page.joinedGroups[lineIndex].length - 1; groupIndex >= 0; groupIndex--) {
                    let group = joinedGroup[groupIndex];
                    //console.log(`Processing page ${pageIndex + 1}, line ${lineIndex + 1}, group ${group}`);
                    mergedText = pages[pageIndex].lines[group].text + " " + mergedText;
                    type = pages[pageIndex].lines[group].type;
                    textType = page.category[lineIndex]
                    regionsArray.push(pages[pageIndex].lines[group].region)
                    column = pages[pageIndex].lines[group].column;
                    line = pages[pageIndex].lines[group].line;
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
              });

                console.log(JSON.stringify(parsedJson, null, 2));

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

            // Wait for LlamaIndex upload to complete
            const llamaUploadResult = await llamaUploadPromise;
            console.log('LlamaIndex upload completed:', llamaUploadResult ? 'Success' : 'Failed');

            // If we reach here, everything was successful
            return NextResponse.json(
              { 
                message: 'File parsed and uploaded successfully',
                llamaIndexUploaded: llamaUploadResult !== null,
                llamaIndexEmbedded: llamaIndexResult !== null,
                parsedJsonPath: parsedJsonPath
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
        if (typeof parsedTempFilePath !== 'undefined') {
          await unlink(parsedTempFilePath);
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

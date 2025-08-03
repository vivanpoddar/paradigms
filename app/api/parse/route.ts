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
      const tempFileName = `${randomUUID()}-${fileName}`;
      tempFilePath = join(tmpdir(), tempFileName);
      await writeFile(tempFilePath, buffer);

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

        let outputFilePath: string | undefined;
        let parsedFilePath: string | undefined;
        let LLMOutput: string | undefined;
        let parsedTempFilePath: string | undefined;

        const result = await pollForCompletion(pdfId);
        if (result) {
          const linesDataJson = JSON.stringify(result, null, 2);

          if (result && Array.isArray(result.pages)) {
            let itemCount = 0;
            const formattedLines = result.pages.flatMap((page: any, pageIndex: number) => {
              if (Array.isArray(page.lines)) {
                return page.lines.map((line: any, lineIndex: number) => {
                  const formattedLine = `${itemCount} | ${line.text} | page ${pageIndex + 1}, line ${lineIndex + 1}, column ${line.column}`;
                  itemCount++;
                  return formattedLine;
                });
              }
              return [];
            });

            const linesForLLM = formattedLines.join('\n');

            const systemPrompt = `
            You are a helpful assistant.Your task is to analyze a list of items extracted from a math homework document of a school student.Follow these steps: \n
            1. ** Determine Joining **: First, decide if any items should be joined together because they are part of the same logical statement or context (e.g., split across multiple lines). If so, merge them into a single item.\n
            2. **Categorize Each Item**: For each item, determine its category:\n
              - **Q**: The item is a question that requires input or action from the reader.\n
              - **R**: The item is relevant information needed to solve a question but does not itself require action. \n
              - **I**: The item is irrelevant or does not contribute to solving the problem.\n \n            
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
                      joinedGroups: {
                        type: "array",
                        items: {
                          type: "array",
                          items: {
                            type: "string"
                          }
                        },
                        description: "A group of items of the same logical statement or context (e.g., [['1','2'], ['3'], ['4','5','6']])"
                      },
                      categories: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            itemNumbers: {
                              type: "string",
                              description: "Item number (e.g., '3')"
                            },
                            category: {
                              type: "string",
                              enum: ["Q", "R", "I"],
                              description: "Q for question, R for relevant info, I for irrelevant"
                            }
                          },
                          required: ["itemNumbers", "category"]
                        }
                      }
                    },
                    required: ["joinedGroups", "categories"]
                  },
                  systemInstruction: systemPrompt,
                  thinkingConfig: {
                    thinkingBudget: 0, // Disables thinking
                  },
                }
              });

              console.log("LLM Response Data:", JSON.stringify(response, null, 2));
              
              // Extract the structured response from Gemini  
              const responseText = response.text;
              if (!responseText) {
                console.error("No response text from Gemini API");
                return NextResponse.json(
                  { error: 'No response from LLM service' },
                  { status: 500 }
                );
              }

              console.log("LLM Response Message:", responseText);
              
              // Parse and validate the structured response
              try {
                const parsedResponse = JSON.parse(responseText);
                console.log("Parsed structured response:", parsedResponse);
                console.log("JoinedGroups:", parsedResponse.joinedGroups);
                console.log("Categories:", parsedResponse.categories);
              } catch (parseError) {
                console.error("Failed to parse structured response:", parseError);
              }

              // Assign to LLMOutput for consistency
              LLMOutput = responseText;

              // Save the content to a file
              const parsedFileName = `${fileName.replace(/\.[^/.]+$/, '')}_llm.json`;
              parsedFilePath = `${userId}/${parsedFileName}`;

              outputFilePath = join(tmpdir(), `${randomUUID()}-${parsedFileName}`);
              await writeFile(outputFilePath, responseText, 'utf8');
              console.log(`LLM response saved to file: ${outputFilePath}`);
              let fileContent;
              try {
                fileContent = await readFile(outputFilePath); // Read as Buffer
              } catch (error) {
                console.error('Error reading the file at outputFilePath:', error);
              }

              // Save parsed results to Supabase "documents" bucket
              console.log("Attempting to upload to Supabase...");
              if (outputFilePath && parsedFilePath && fileContent) {
                const { data: uploadLinesData, error: uploadError } = await supabase.storage
                  .from('documents')
                  .upload(parsedFilePath, fileContent, {
                    contentType: 'application/json',
                    upsert: true, // This will overwrite if file already exists
                  });

                if (uploadError) {
                  console.error('Supabase upload error:', uploadError);
                  return NextResponse.json(
                    { error: `Failed to save parsed document: ${uploadError.message}` },
                    { status: 500 }
                  );
                }

                console.log('File uploaded successfully to Supabase.');
                
                // Clean up the temporary file
                await unlink(outputFilePath);
              } else {
                console.error("Output file path or parsed file path is undefined.");
              }

            } catch (llmError) {
              console.error("LLM API error:", llmError);
              return NextResponse.json(
                { error: `LLM API error: ${llmError instanceof Error ? llmError.message : 'Unknown LLM error'}` },
                { status: 500 }
              );
            }
          }

          return NextResponse.json(
            { message: 'File parsed and uploaded successfully', parsedFilePath },
            { status: 200 }
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

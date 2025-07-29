import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import fs from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'

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
      console.log("Response Data:", JSON.stringify(data, null, 2));
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
              console.log("Job completed. PDF Data:", JSON.stringify(data, null, 2));
              return data; // Return the completed data
            } else if (data.status === "error") {
              console.error("Job failed with error:", data);
              return null;
            } else if (data.status === undefined) {
              console.log("Job status is undefined. Printing final result...");
              console.log("Final Result:", JSON.stringify(data, null, 2));
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

        const result = await pollForCompletion(pdfId);
        if (result) {
          console.log("Final Result:", JSON.stringify(result, null, 2));

          if (result && Array.isArray(result.pages)) {
            let itemCount = 0;
            result.pages.forEach((page: any, pageIndex: number) => {
              if (Array.isArray(page.lines)) {
                page.lines.forEach((line: any, lineIndex: number) => {
                  // Print as [item number]: [pages.lines.text]
                  console.log(`[${itemCount}]: ${line.text}`);
                  itemCount++;
                });
              }
            });
          }

          const linesDataJson = JSON.stringify(result, null, 2);

          // Save parsed results to Supabase "documents" bucket
          const parsedFileName = `${fileName.replace(/\.[^/.]+$/, '')}_parsed.json`;
          const parsedFilePath = `${userId}/${parsedFileName}`;

          // Write the parsed result to a temporary file
          parsedTempFilePath = join(tmpdir(), `${randomUUID()}-${parsedFileName}`);
          await writeFile(parsedTempFilePath, linesDataJson);

          const fileStream = fs.createReadStream(parsedTempFilePath);

          const { data: uploadLinesData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(parsedFilePath, fileStream, {
              contentType: 'application/json',
              upsert: true, // This will overwrite if file already exists
              duplex: 'half'
            });

          // Clean up the temporary parsed file
          await unlink(parsedTempFilePath);

          if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return NextResponse.json(
              { error: `Failed to save parsed document: ${uploadError.message}` },
              { status: 500 }
            );
          }

          // Success: return the upload data or a success message
          return NextResponse.json(
            { message: 'File parsed and uploaded successfully', parsedFilePath },
            { status: 200 }
          );
        }
      } else {
        console.error("Cannot proceed without a valid pdf_id.");
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

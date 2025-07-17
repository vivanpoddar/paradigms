import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

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

    // Create a temporary file for LlamaParse
    const tempFileName = `${randomUUID()}-${fileName}`
    const tempFilePath = join(tmpdir(), tempFileName)
    
    try {
      // Convert blob to buffer and write to temporary file
      const buffer = Buffer.from(await fileData.arrayBuffer())
      await writeFile(tempFilePath, buffer)

      // Use direct API approach with improved error handling (based on test.ts)
      console.log(`Parsing document: ${fileName}`)
      
      // Step 1: Upload file and create job
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName);
      formData.append('language', 'en');
      formData.append('resultType', 'json');

      const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`LlamaParse API error: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload result:', uploadResult);

      if (!uploadResult.id) {
        throw new Error('No job ID returned from LlamaParse API');
      }

      const jobId = uploadResult.id;
      console.log('Job ID:', jobId);

      // Step 2: Poll for job completion
      let jobComplete = false;
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes with 10 second intervals
      let parsedResult;

      while (!jobComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
          }
        });

        if (!statusResponse.ok) {
          throw new Error(`Failed to check job status: ${statusResponse.status}`);
        }

        const status = await statusResponse.json();
        console.log(`Attempt ${attempts + 1}: Job status:`, status.status);

        if (status.status === 'SUCCESS') {
          jobComplete = true;
          console.log('Job completed successfully!');
          
          // Step 3: Get the result
          const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`, {
            headers: {
              'Authorization': `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
            }
          });

          if (!resultResponse.ok) {
            throw new Error(`Failed to get parsed result: ${resultResponse.status}`);
          }

          parsedResult = await resultResponse.json();
          console.log('Final JSON result received');

        } else if (status.status === 'ERROR') {
          throw new Error(`Parsing job failed: ${status.error || 'Unknown error'}`);
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Parsing job timed out after 5 minutes');
      }

      if (!parsedResult) {
        throw new Error('No parsed result received');
      }

      console.log(`Successfully parsed ${fileName}`);

      // Clean up temporary file
      await unlink(tempFilePath);

      // Return the parsed result
        // Save parsed results to Supabase "documents" bucket
    const parsedFileName = `${fileName.replace(/\.[^/.]+$/, '')}_parsed.json`
    const parsedFilePath = `${userId}/${parsedFileName}`

    const jsonResult = JSON.stringify(parsedResult, null, 2)

    console.log("jsonResult:" + jsonResult)

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(parsedFilePath, jsonResult, {
            contentType: 'application/json',
            upsert: true // This will overwrite if file already exists
        })

    if (uploadError) {
        console.error('Supabase upload error:', uploadError)
        return NextResponse.json(
            { error: `Failed to save parsed document: ${uploadError.message}` },
            { status: 500 }
        )
    }

    // Success: return the upload data or a success message
    return NextResponse.json(
      { message: 'File parsed and uploaded successfully', parsedFilePath },
      { status: 200 }
    )

    } catch (parseError) {
      console.error('LlamaParse error:', parseError)
      
      // Clean up temporary file if it exists
      try {
        await unlink(tempFilePath)
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

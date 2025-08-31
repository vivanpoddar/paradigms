import { NextRequest, NextResponse } from 'next/server'
import { openai } from "@llamaindex/openai"
import jsPDF from 'jspdf'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== PDF WORKSHEET API CALLED ===');
  try {
    const { prompt, userId, containsMath = false } = await request.json();
    console.log('Received prompt:', prompt);
    console.log('Received userId:', userId);
    console.log('Contains math:', containsMath);

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'UserId is required and must be a string' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const llm = openai({
      model: "gpt-4o-mini",
      temperature: 0.7,
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Enhanced prompt for worksheet generation
    const enhancedPrompt = `You are an expert educational content creator. Create a well-structured PDF worksheet based on the following prompt:

"${prompt}"

Please generate content that includes:
1. A clear title for the worksheet
2. Instructions or learning objectives
3. 5-8 practice problems or exercises with varying difficulty levels
4. Space for students to work on solutions
5. If applicable, include formulas, definitions, or key concepts at the top
  
Format your response as a JSON object with the following structure:
{
  "isMath": "Contains math content (true/false)",
  "title": "Worksheet Title",
  "instructions": "Brief instructions for students",
  "keyPoints": ["Important concept 1", "Important concept 2"],
  "problems": [
    {
      "number": 1,
      "question": "Problem text here",
      "difficulty": "easy|medium|hard",
      "workSpace": "Amount of space needed for solution (small|medium|large)"
    }
  ]
}

Ensure the content is educationally sound, age-appropriate, and provides good practice opportunities.`;

    console.log('Generating worksheet content...');
    const completion = await llm.chat({
      messages: [{ role: "user", content: enhancedPrompt }],
    });

    const responseText = typeof completion.message.content === 'string'
      ? completion.message.content
      : Array.isArray(completion.message.content)
        ? completion.message.content.map((c: any) => c.text || '').join('\n')
        : '';
    console.log('Generated content:', responseText);

    // Parse the JSON response
    let worksheetData;
    try {
      // Extract JSON from the response (in case it's wrapped in markdown)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
      worksheetData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      return NextResponse.json(
        { error: 'Failed to generate valid worksheet content' },
        { status: 500 }
      );
    }

    let isMath = worksheetData.isMath === true || worksheetData.isMath === 'true';

    // Generate PDF
    console.log('Generating PDF...');
    const pdf = new jsPDF();
    
    // Set up fonts and styling
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    
    // Title
    const title = worksheetData.title || 'Worksheet';
    pdf.text(title, 20, 30);
    
    // Instructions
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    const instructions = worksheetData.instructions || '';
    if (instructions) {
      const instructionLines = pdf.splitTextToSize(instructions, 170);
      pdf.text(instructionLines, 20, 50);
    }
    
    let yPosition = instructions ? 70 : 50;
    
    // Key Points
    if (worksheetData.keyPoints && worksheetData.keyPoints.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.text('Key Concepts:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont("helvetica", "normal");
      worksheetData.keyPoints.forEach((point: string, index: number) => {
        const pointText = `• ${point}`;
        const pointLines = pdf.splitTextToSize(pointText, 170);
        pdf.text(pointLines, 25, yPosition);
        yPosition += pointLines.length * 5;
      });
      yPosition += 10;
    }
    
    // Problems
    if (worksheetData.problems && worksheetData.problems.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.text('Problems:', 20, yPosition);
      yPosition += 15;
      
      worksheetData.problems.forEach((problem: any, index: number) => {
        // Check if we need a new page
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 30;
        }
        
        pdf.setFont("helvetica", "bold");
        pdf.text(`${problem.number || index + 1}.`, 20, yPosition);
        
        pdf.setFont("helvetica", "normal");
        const questionLines = pdf.splitTextToSize(problem.question || '', 160);
        pdf.text(questionLines, 30, yPosition);
        yPosition += questionLines.length * 5 + 5;
        
        // Add workspace based on difficulty
        const workSpaceHeight = problem.workSpace === 'large' ? 40 : 
                               problem.workSpace === 'medium' ? 25 : 15;
        
        // Draw lines for student work
        for (let i = 0; i < Math.floor(workSpaceHeight / 5); i++) {
          pdf.line(30, yPosition + (i * 5), 180, yPosition + (i * 5));
        }
        
        yPosition += workSpaceHeight + 10;
      });
    }
    
    // Generate PDF buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    
    console.log('PDF generated successfully');
    
    // Upload PDF to Supabase storage
    const supabase = await createClient();
      const fileName = `${worksheetData.title?.replace(/[^a-z0-9]/gi, '_') || 'worksheet'}-${Date.now()}.pdf`;
    const bucketName = 'documents'; // Assuming this is your bucket name
    const uploadPath = `${userId}/${fileName}`;
    
    console.log('Uploading PDF to Supabase storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(uploadPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Failed to upload PDF to Supabase:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload PDF to storage' },
        { status: 500 }
      );
    }

    console.log('PDF uploaded successfully:', uploadData);
    
    // Return success even if parsing fails - parsing can be done later manually
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadPath);

    console.log('Worksheet creation completed successfully');
    
    // Automatically parse the PDF using the appropriate endpoint
    console.log(`Parsing PDF using ${isMath ? '/api/mparse' : '/api/nparse'}...`);
    const parseEndpoint = isMath ? '/api/mparse' : '/api/nparse';
    console.log(`Parsing PDF using ${parseEndpoint}...`);
    
    let parseResult = null;
    let parseError = null;
    
    try {
      // Get the base URL for internal API calls
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      
      // Prepare the data for the parsing API (it expects JSON with file metadata)
      const parseData = {
        fileName,
        bucketName,
        uploadPath,
        userId
      };
      
      // Make the parsing API call with proper headers
      const parseResponse = await fetch(`${baseUrl}${parseEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward relevant headers for authentication
          'cookie': request.headers.get('cookie') || '',
          'authorization': request.headers.get('authorization') || '',
        },
        body: JSON.stringify(parseData),
      });
      
      if (parseResponse.ok) {
        parseResult = await parseResponse.json();
        console.log('PDF parsing completed successfully');
      } else {
        const errorText = await parseResponse.text();
        parseError = `Parsing failed with status ${parseResponse.status}: ${errorText}`;
        console.error('PDF parsing failed:', parseError);
      }
    } catch (error) {
      parseError = `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('Error during PDF parsing:', error);
    }
    
    return NextResponse.json({
      success: true,
      fileName,
      downloadUrl: publicUrl,
      worksheetData,
      parsing: {
        success: parseResult !== null,
        result: parseResult,
        error: parseError,
        endpoint: parseEndpoint
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error generating PDF worksheet:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF worksheet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

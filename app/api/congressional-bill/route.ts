import { NextRequest, NextResponse } from 'next/server'
import { openai } from "@llamaindex/openai"
import jsPDF from 'jspdf'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== CONGRESSIONAL BILL API CALLED ===');
  try {
    const { prompt, userId, containsLegalContent = false } = await request.json();
    console.log('Received prompt:', prompt);
    console.log('Received userId:', userId);
    console.log('Contains legal content:', containsLegalContent);

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

    // Enhanced prompt for congressional bill generation
    const enhancedPrompt = `You are an expert legislative drafting assistant with extensive knowledge of congressional procedures and legal language. Create a well-structured congressional bill based on the following request:

"${prompt}"

Please generate a realistic congressional bill that includes:
1. A proper bill number (format: H.R. XXXX or S. XXXX)
2. A descriptive title reflecting the bill's purpose
3. Congressional session information (e.g., "119th Congress, 1st Session")
4. Sponsor information (fictional but realistic)
5. An enacting clause
6. A structured body with sections including:
   - Findings and Purpose
   - Definitions (if applicable)
   - Main provisions organized by sections
   - Implementation and enforcement provisions
   - Effective date
7. Proper legal formatting and language
8. Committee references (fictional but appropriate)

Format your response as a JSON object with the following structure:
{
  "isLegal": "Contains legal/policy content (true/false)",
  "billNumber": "H.R. 1234 or S. 1234",
  "title": "Full Bill Title",
  "congress": "119th Congress, 1st Session",
  "sponsor": "Representative/Senator Name (State-District/State)",
  "committee": "Committee on [Relevant Committee Name]",
  "enactingClause": "Be it enacted by the Senate and House of Representatives...",
  "sections": [
    {
      "number": "SEC. 1.",
      "title": "SHORT TITLE",
      "content": "This Act may be cited as the '[Act Name]'."
    },
    {
      "number": "SEC. 2.",
      "title": "FINDINGS AND PURPOSE",
      "content": "Congress finds that... The purpose of this Act is..."
    },
    {
      "number": "SEC. 3.",
      "title": "DEFINITIONS",
      "content": "In this Act: (1) TERM.—The term 'example' means..."
    }
  ],
  "effectiveDate": "This Act shall take effect on..."
}

Ensure the bill is professionally drafted, uses proper congressional formatting, addresses a realistic policy issue, and follows standard legislative conventions. The content should be substantive but appropriate for the complexity requested.`;

    console.log('Generating congressional bill content...');
    const completion = await llm.chat({
      messages: [{ role: "user", content: enhancedPrompt }],
    });

    const responseText = completion.message.content;
    console.log('Generated content:', responseText);

    // Parse the JSON response
    let billData;
    try {
      // Convert MessageContent to string if needed
      const contentString = typeof responseText === 'string' ? responseText : 
        Array.isArray(responseText) ? responseText.map(item => {
          if (typeof item === 'string') return item;
          if ('text' in item) return item.text;
          return '';
        }).join('') : String(responseText);
      
      // Extract JSON from the response (in case it's wrapped in markdown)
      const jsonMatch = contentString.match(/```json\s*([\s\S]*?)\s*```/) || contentString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : contentString;
      billData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      return NextResponse.json(
        { error: 'Failed to generate valid congressional bill content' },
        { status: 500 }
      );
    }

    let isLegal = billData.isLegal === true || billData.isLegal === 'true';

    // Generate PDF
    console.log('Generating congressional bill PDF...');
    const pdf = new jsPDF();
    
    // Set up fonts and styling for formal legal document
    pdf.setFontSize(12);
    pdf.setFont("times", "normal");
    
    let yPosition = 30;
    
    // Header - Congress and Session
    pdf.setFontSize(14);
    pdf.setFont("times", "bold");
    const congress = billData.congress || '119th Congress, 1st Session';
    pdf.text(congress, 105, yPosition, { align: 'center' });
    yPosition += 20;
    
    // Bill Number
    pdf.setFontSize(16);
    const billNumber = billData.billNumber || 'H.R. XXXX';
    pdf.text(billNumber, 105, yPosition, { align: 'center' });
    yPosition += 25;
    
    // Title
    pdf.setFontSize(12);
    pdf.setFont("times", "bold");
    const title = billData.title || 'Congressional Bill';
    const titleLines = pdf.splitTextToSize(title, 170);
    titleLines.forEach((line: string) => {
      pdf.text(line, 105, yPosition, { align: 'center' });
      yPosition += 6;
    });
    yPosition += 15;
    
    // Sponsor and Committee
    pdf.setFontSize(10);
    pdf.setFont("times", "italic");
    if (billData.sponsor) {
      pdf.text(`Introduced by ${billData.sponsor}`, 20, yPosition);
      yPosition += 8;
    }
    if (billData.committee) {
      pdf.text(`Referred to the ${billData.committee}`, 20, yPosition);
      yPosition += 15;
    }
    
    // Enacting Clause
    pdf.setFont("times", "normal");
    pdf.setFontSize(11);
    const enactingClause = billData.enactingClause || 
      'Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled,';
    const enactingLines = pdf.splitTextToSize(enactingClause, 170);
    enactingLines.forEach((line: string) => {
      pdf.text(line, 20, yPosition);
      yPosition += 5;
    });
    yPosition += 15;
    
    // Sections
    if (billData.sections && billData.sections.length > 0) {
      billData.sections.forEach((section: any) => {
        // Check if we need a new page
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 30;
        }
        
        // Section number and title
        pdf.setFont("times", "bold");
        pdf.setFontSize(11);
        const sectionHeader = `${section.number} ${section.title}`;
        pdf.text(sectionHeader, 20, yPosition);
        yPosition += 10;
        
        // Section content
        pdf.setFont("times", "normal");
        pdf.setFontSize(10);
        const contentLines = pdf.splitTextToSize(section.content || '', 170);
        contentLines.forEach((line: string) => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 30;
          }
          pdf.text(line, 30, yPosition);
          yPosition += 5;
        });
        yPosition += 15;
      });
    }
    
    // Effective Date
    if (billData.effectiveDate) {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 30;
      }
      
      pdf.setFont("times", "bold");
      pdf.setFontSize(11);
      pdf.text('EFFECTIVE DATE', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont("times", "normal");
      pdf.setFontSize(10);
      const effectiveDateLines = pdf.splitTextToSize(billData.effectiveDate, 170);
      effectiveDateLines.forEach((line: string) => {
        pdf.text(line, 30, yPosition);
        yPosition += 5;
      });
    }
    
    // Generate PDF buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    
    console.log('Congressional bill PDF generated successfully');
    
    // Upload PDF to Supabase storage
    const supabase = await createClient();
    const fileName = `${billData.title?.replace(/[^a-z0-9]/gi, '_') || 'congressional_bill'}-${Date.now()}.pdf`;
    const bucketName = 'documents';
    const uploadPath = `${userId}/${fileName}`;
    
    console.log('Uploading congressional bill PDF to Supabase storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(uploadPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Failed to upload congressional bill PDF to Supabase:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload congressional bill PDF to storage' },
        { status: 500 }
      );
    }

    console.log('Congressional bill PDF uploaded successfully:', uploadData);
    
    // Get public URL for download
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadPath);

    console.log('Congressional bill creation completed successfully');
    
    // Automatically parse the PDF using the appropriate endpoint
    console.log(`Parsing congressional bill PDF using /api/nparse...`);
    
    let parseResult = null;
    let parseError = null;
    
    try {
      // Get the base URL for internal API calls
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      
      // Download the PDF from Supabase to send to parsing API
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(uploadPath);
      
      if (downloadError) {
        throw new Error(`Failed to download file for parsing: ${downloadError.message}`);
      }
      
      // Create multipart/form-data payload manually for Node.js compatibility
      const boundary = `----formdata-boundary-${Date.now()}`;
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Build multipart form data properly
      const CRLF = '\r\n';
      
      // Start with fileName field
      let formDataBody = `--${boundary}${CRLF}`;
      formDataBody += `Content-Disposition: form-data; name="fileName"${CRLF}`;
      formDataBody += `${CRLF}`;
      formDataBody += `${fileName}${CRLF}`;
      
      // Add file field
      formDataBody += `--${boundary}${CRLF}`;
      formDataBody += `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`;
      formDataBody += `Content-Type: application/pdf${CRLF}`;
      formDataBody += `${CRLF}`;
      
      // End boundary
      const endBoundary = `${CRLF}--${boundary}--${CRLF}`;
      
      // Combine all parts
      const startBuffer = Buffer.from(formDataBody, 'utf8');
      const endBuffer = Buffer.from(endBoundary, 'utf8');
      
      const finalBuffer = Buffer.concat([startBuffer, buffer, endBuffer]);
      
      // Make the parsing API call with proper multipart data
      const parseResponse = await fetch(`${baseUrl}/api/nparse`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'cookie': request.headers.get('cookie') || '',
          'authorization': request.headers.get('authorization') || '',
        },
        body: finalBuffer,
      });
      
      if (parseResponse.ok) {
        parseResult = await parseResponse.json();
        console.log('Congressional bill PDF parsing completed successfully');
      } else {
        const errorText = await parseResponse.text();
        parseError = `Parsing failed with status ${parseResponse.status}: ${errorText}`;
        console.error('Congressional bill PDF parsing failed:', parseError);
      }
    } catch (error) {
      parseError = `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('Error during congressional bill PDF parsing:', error);
    }
    
    return NextResponse.json({
      success: true,
      fileName,
      downloadUrl: publicUrl,
      billData,
      parsing: {
        success: parseResult !== null,
        result: parseResult,
        error: parseError,
        endpoint: '/api/nparse'
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error generating congressional bill:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate congressional bill',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

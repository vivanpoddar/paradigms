import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Interface matching the extraction schema
interface ExtractionResult {
  amendments_to_existing_law?: {
    law_reference: string;
    modification: string;
  }[];
  appropriations?: {
    amount: string;
    purpose: string;
  }[];
  bill_id?: string;
  congressional_session?: string;
  definitions?: {
    meaning: string;
    term: string;
  }[];
  effective_date?: string;
  enacting_clause?: string;
  findings_purpose?: string;
  implementation_enforcement?: {
    agency: string;
    penalties: string;
    responsibilities: string;
  };
  miscellaneous?: string;
  notes?: string;
  provisions?: {
    heading: string;
    section_number: string;
    text: string;
  }[];
  sponsor?: {
    name: string;
    party: string;
    state: string;
  };
  sunset_clause?: string;
}

// Helper function to extract structured data from OCR text
const parseExtractionData = (text: string): ExtractionResult => {
  const result: ExtractionResult = {};

  // Extract Bill ID (looking for patterns like H.R. 1234, S. 5678, etc.)
  const billIdMatch = text.match(/(?:H\.R\.|S\.|H\.R\.E\.S\.|S\.R\.E\.S\.)\s*\d+/i);
  if (billIdMatch) {
    result.bill_id = billIdMatch[0];
  }

  // Extract Congressional Session (looking for patterns like "117th Congress", "118th Congress", etc.)
  const sessionMatch = text.match(/(\d+)(?:st|nd|rd|th)\s+Congress/i);
  if (sessionMatch) {
    result.congressional_session = sessionMatch[0];
  }

  // Extract Sponsor information (looking for "Introduced by", "Sponsored by", etc.)
  const sponsorMatch = text.match(/(?:Introduced by|Sponsored by|Mr\.|Mrs\.|Ms\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:\(([A-Z]+)-([A-Z]{2})\))?/i);
  if (sponsorMatch) {
    result.sponsor = {
      name: sponsorMatch[1],
      party: sponsorMatch[2] || '',
      state: sponsorMatch[3] || ''
    };
  }

  // Extract Effective Date (looking for "effective", "shall take effect", etc.)
  const effectiveDateMatch = text.match(/(?:effective|shall take effect|becomes effective)\s+(?:on\s+)?([A-Za-z]+ \d{1,2}, \d{4}|January \d{1,2}, \d{4}|February \d{1,2}, \d{4}|March \d{1,2}, \d{4}|April \d{1,2}, \d{4}|May \d{1,2}, \d{4}|June \d{1,2}, \d{4}|July \d{1,2}, \d{4}|August \d{1,2}, \d{4}|September \d{1,2}, \d{4}|October \d{1,2}, \d{4}|November \d{1,2}, \d{4}|December \d{1,2}, \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (effectiveDateMatch) {
    result.effective_date = effectiveDateMatch[1];
  }

  // Extract Enacting Clause (usually at the beginning of bills)
  const enactingMatch = text.match(/Be it enacted by the Senate and House of Representatives[^.]*\./i);
  if (enactingMatch) {
    result.enacting_clause = enactingMatch[0];
  }

  // Extract Findings and Purpose (looking for "FINDINGS" or "PURPOSE" sections)
  const findingsMatch = text.match(/(?:FINDINGS?|PURPOSE|CONGRESSIONAL FINDINGS?)[.\s\n]+([^§]*?)(?=§|\n\n|$)/i);
  if (findingsMatch) {
    result.findings_purpose = findingsMatch[1].trim();
  }

  // Extract Appropriations (looking for dollar amounts and funding purposes)
  const appropriationMatches = text.matchAll(/(?:appropriated?|authorized?|funding?)[^$]*\$([0-9,]+(?:\.[0-9]{2})?(?:\s*(?:million|billion|thousand))?)[^.]*for\s+([^.]*)/gi);
  result.appropriations = [];
  for (const match of appropriationMatches) {
    result.appropriations.push({
      amount: `$${match[1]}`,
      purpose: match[2].trim()
    });
  }

  // Extract Definitions (looking for definition sections)
  const definitionMatches = text.matchAll(/(?:the term|means|definition)[^"']*["']([^"']+)["'][^"']*means[^"']*["']([^"']+)["']/gi);
  result.definitions = [];
  for (const match of definitionMatches) {
    result.definitions.push({
      term: match[1].trim(),
      meaning: match[2].trim()
    });
  }

  // Extract Sunset Clause (looking for expiration dates)
  const sunsetMatch = text.match(/(?:expires?|terminates?|sunset|shall cease)[^.]*?(?:on|after)\s+([A-Za-z]+ \d{1,2}, \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (sunsetMatch) {
    result.sunset_clause = sunsetMatch[0];
  }

  // Extract Provisions (looking for section numbers and headings)
  const provisionMatches = text.matchAll(/(?:§|SEC\.|SECTION)\s*(\d+)\.\s*([A-Z][^.]*\.)/gi);
  result.provisions = [];
  for (const match of provisionMatches) {
    result.provisions.push({
      section_number: match[1],
      heading: match[2].trim(),
      text: match[0]
    });
  }

  // Extract Implementation and Enforcement (looking for agency assignments)
  const implementationMatch = text.match(/(?:Secretary|Administrator|Director|Commission)[^.]*shall[^.]*(?:implement|enforce|administer)/i);
  if (implementationMatch) {
    result.implementation_enforcement = {
      agency: implementationMatch[0],
      penalties: '',
      responsibilities: implementationMatch[0]
    };
  }

  return result;
};

export async function POST(request: NextRequest) {
  try {
    const { fileName, bucketName, uploadPath, userId } = await request.json();

    if (!fileName || !bucketName || !uploadPath || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, bucketName, uploadPath, userId' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Try to get the parsed JSON first (from nparse processing)
    const parsedJsonPath = uploadPath.replace(/\.(pdf|doc|docx)$/i, '_parsed.json');
    
    let extractedText = '';
    
    // Try to get OCR text file
    const ocrTextPath = uploadPath.replace(/\.(pdf|doc|docx)$/i, '_ocr.txt');
    const { data: ocrData, error: ocrError } = await supabase.storage
      .from(bucketName)
      .download(ocrTextPath);

    if (ocrData && !ocrError) {
      extractedText = await ocrData.text();
    } else {
      // Fallback: try to get parsed JSON and extract text from it
      const { data: parsedData, error: parsedError } = await supabase.storage
        .from(bucketName)
        .download(parsedJsonPath);

      if (parsedData && !parsedError) {
        const parsedJson = JSON.parse(await parsedData.text());
        // Extract text from parsed JSON structure
        if (parsedJson.page && Array.isArray(parsedJson.page)) {
          extractedText = parsedJson.page
            .flatMap((page: any) => page.lines || [])
            .map((line: any) => line.text || '')
            .join(' ');
        }
      }
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'No extracted text found for this document. Please process the document first.' },
        { status: 404 }
      );
    }

    // Parse the extracted text according to the schema
    const extractionResult = parseExtractionData(extractedText);

    // Store the structured extraction result
    const extractionResultPath = uploadPath.replace(/\.(pdf|doc|docx)$/i, '_extraction.json');
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(extractionResultPath, JSON.stringify(extractionResult, null, 2), {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading extraction result:', uploadError);
    }

    return NextResponse.json({
      success: true,
      extractionResult,
      extractionResultPath,
      textLength: extractedText.length,
      fieldsExtracted: Object.keys(extractionResult).length
    });

  } catch (error) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read the JSON file from the public directory
    const filePath = path.join(process.cwd(), 'public', 'bounding-boxes.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading bounding boxes file:', error);
    
    // Return fallback data if file can't be read
    const fallbackData = [
      {
        id: "api-fallback-1",
        x: 50,
        y: 100,
        width: 200,
        height: 30,
        text: "API Fallback Title",
        pageNumber: 1
      },
      {
        id: "api-fallback-2",
        x: 50,
        y: 150,
        width: 300,
        height: 20,
        text: "This is API fallback paragraph text",
        pageNumber: 1
      },
      {
        id: "api-fallback-3",
        x: 50,
        y: 200,
        width: 250,
        height: 18,
        text: "Another line of API fallback text",
        pageNumber: 1
      }
    ];
    
    return NextResponse.json(fallbackData);
  }
}

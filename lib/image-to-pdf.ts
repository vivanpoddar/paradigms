import { jsPDF } from 'jspdf';

/**
 * Converts an image file to a PDF file
 * @param imageFile - The image file to convert
 * @returns A new File object containing the PDF
 */
export async function convertImageToPDF(imageFile: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate dimensions
          const imgWidth = img.width;
          const imgHeight = img.height;
          
          // Determine orientation and page size
          // Use A4 proportions but scale to fit the image
          const a4Ratio = 210 / 297; // A4 width/height ratio in mm
          const imgRatio = imgWidth / imgHeight;
          
          let pdfWidth: number;
          let pdfHeight: number;
          
          if (imgRatio > a4Ratio) {
            // Image is wider than A4 ratio - fit to width
            pdfWidth = 210;
            pdfHeight = 210 / imgRatio;
          } else {
            // Image is taller than A4 ratio - fit to height
            pdfHeight = 297;
            pdfWidth = 297 * imgRatio;
          }
          
          // Create PDF with appropriate orientation
          const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
          const pdf = new jsPDF({
            orientation,
            unit: 'mm',
            format: [pdfWidth, pdfHeight]
          });
          
          // Add image to PDF (fill entire page)
          const imgData = e.target?.result as string;
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          
          // Convert PDF to blob
          const pdfBlob = pdf.output('blob');
          
          // Create a new File object with PDF extension
          const pdfFileName = imageFile.name.replace(/\.(png|jpg|jpeg|gif|webp|bmp|tiff)$/i, '.pdf');
          const pdfFile = new File([pdfBlob], pdfFileName, {
            type: 'application/pdf',
            lastModified: Date.now()
          });
          
          resolve(pdfFile);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Checks if a file is an image based on its MIME type
 * @param file - The file to check
 * @returns true if the file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Checks if a file is a PDF based on its MIME type
 * @param file - The file to check
 * @returns true if the file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf';
}

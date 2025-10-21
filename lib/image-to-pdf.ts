import { jsPDF } from 'jspdf';
import { parse } from 'exifr';

/**
 * Converts an image file to a PDF file
 * @param imageFile - The image file to convert
 * @returns A new File object containing the PDF
 */
export async function convertImageToPDF(imageFile: File): Promise<File> {
  return new Promise(async (resolve, reject) => {
    const exif = await parse(imageFile, { pick: ['Orientation'] });
    const orientation = exif?.Orientation || 1

    console.log(`Image Orientation: ${orientation}`);

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Create a canvas to handle rotation based on EXIF orientation
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          
          let imgWidth = img.width;
          let imgHeight = img.height;
          
          // Set canvas dimensions and apply transformations based on EXIF orientation
          // EXIF orientation values: 1-8
          // 1 = Normal (0°)
          // 2 = Flip horizontal
          // 3 = Rotate 180°
          // 4 = Flip vertical
          // 5 = Rotate 90° CW + Flip horizontal
          // 6 = Rotate 90° CW
          // 7 = Rotate 90° CCW + Flip horizontal
          // 8 = Rotate 90° CCW
          
          switch (orientation) {
            case 2:
              // Flip horizontal
              canvas.width = imgWidth;
              canvas.height = imgHeight;
              ctx.transform(-1, 0, 0, 1, imgWidth, 0);
              break;
            case 3:
              // Rotate 180°
              canvas.width = imgWidth;
              canvas.height = imgHeight;
              ctx.transform(-1, 0, 0, -1, imgWidth, imgHeight);
              break;
            case 4:
              // Flip vertical
              canvas.width = imgWidth;
              canvas.height = imgHeight;
              ctx.transform(1, 0, 0, -1, 0, imgHeight);
              break;
            case 5:
              // Rotate 90° CW + Flip horizontal
              canvas.width = imgHeight;
              canvas.height = imgWidth;
              ctx.transform(0, 1, 1, 0, 0, 0);
              break;
            case 6:
              // Rotate 90° CW
              canvas.width = imgHeight;
              canvas.height = imgWidth;
              ctx.transform(0, 1, -1, 0, imgHeight, 0);
              [imgWidth, imgHeight] = [imgHeight, imgWidth];
              break;
            case 7:
              // Rotate 90° CCW + Flip horizontal
              canvas.width = imgHeight;
              canvas.height = imgWidth;
              ctx.transform(0, -1, -1, 0, imgHeight, imgWidth);
              break;
            case 8:
              // Rotate 90° CCW
              canvas.width = imgHeight;
              canvas.height = imgWidth;
              ctx.transform(0, -1, 1, 0, 0, imgWidth);
              [imgWidth, imgHeight] = [imgHeight, imgWidth];
              break;
            default:
              // Normal orientation (1)
              canvas.width = imgWidth;
              canvas.height = imgHeight;
          }
          
          // Draw the image with the applied transformations
          ctx.drawImage(img, 0, 0);
          
          // Get the corrected image data
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          
          // Calculate dimensions using corrected width/height
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
          
          // Create PDF with appropriate orientation based on corrected dimensions
          const pdfOrientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
          const pdf = new jsPDF({
            orientation: pdfOrientation,
            unit: 'mm',
            format: [pdfWidth, pdfHeight]
          });
          
          // Add rotated image to PDF (fill entire page)
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

/**
 * Concatenates multiple image files into a single PDF
 * @param imageFiles - Array of image files to concatenate
 * @returns A new File object containing the concatenated PDF
 */
export async function concatenateImagesToPDF(imageFiles: File[]): Promise<File> {
  if (imageFiles.length === 0) {
    throw new Error('No images provided');
  }

  // If only one image, use the standard conversion
  if (imageFiles.length === 1) {
    return convertImageToPDF(imageFiles[0]);
  }

  let pdf: jsPDF | undefined = undefined;
  let pageCount = 0;

  try {
    for (const imageFile of imageFiles) {
      const exif = await parse(imageFile, { pick: ['Orientation'] });
      const orientation = exif?.Orientation || 1;

      await new Promise<void>((resolveImage, rejectImage) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          const img = new Image();
          
          img.onload = () => {
            try {
              // Create a canvas to handle rotation based on EXIF orientation
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                throw new Error('Could not get canvas context');
              }
              
              let imgWidth = img.width;
              let imgHeight = img.height;
              
              // Apply EXIF orientation transformations
              switch (orientation) {
                case 2:
                  canvas.width = imgWidth;
                  canvas.height = imgHeight;
                  ctx.transform(-1, 0, 0, 1, imgWidth, 0);
                  break;
                case 3:
                  canvas.width = imgWidth;
                  canvas.height = imgHeight;
                  ctx.transform(-1, 0, 0, -1, imgWidth, imgHeight);
                  break;
                case 4:
                  canvas.width = imgWidth;
                  canvas.height = imgHeight;
                  ctx.transform(1, 0, 0, -1, 0, imgHeight);
                  break;
                case 5:
                  canvas.width = imgHeight;
                  canvas.height = imgWidth;
                  ctx.transform(0, 1, 1, 0, 0, 0);
                  break;
                case 6:
                  canvas.width = imgHeight;
                  canvas.height = imgWidth;
                  ctx.transform(0, 1, -1, 0, imgHeight, 0);
                  [imgWidth, imgHeight] = [imgHeight, imgWidth];
                  break;
                case 7:
                  canvas.width = imgHeight;
                  canvas.height = imgWidth;
                  ctx.transform(0, -1, -1, 0, imgHeight, imgWidth);
                  break;
                case 8:
                  canvas.width = imgHeight;
                  canvas.height = imgWidth;
                  ctx.transform(0, -1, 1, 0, 0, imgWidth);
                  [imgWidth, imgHeight] = [imgHeight, imgWidth];
                  break;
                default:
                  canvas.width = imgWidth;
                  canvas.height = imgHeight;
              }
              
              // Draw the image with the applied transformations
              ctx.drawImage(img, 0, 0);
              
              // Get the corrected image data
              const imgData = canvas.toDataURL('image/jpeg', 0.95);
              
              // Calculate dimensions
              const a4Ratio = 210 / 297;
              const imgRatio = imgWidth / imgHeight;
              
              let pdfWidth: number;
              let pdfHeight: number;
              
              if (imgRatio > a4Ratio) {
                pdfWidth = 210;
                pdfHeight = 210 / imgRatio;
              } else {
                pdfHeight = 297;
                pdfWidth = 297 * imgRatio;
              }
              
              // Create PDF on first image, add page on subsequent images
              if (!pdf) {
                const pdfOrientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
                pdf = new jsPDF({
                  orientation: pdfOrientation,
                  unit: 'mm',
                  format: [pdfWidth, pdfHeight]
                });
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
              } else {
                pdf.addPage([pdfWidth, pdfHeight]);
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
              }
              
              pageCount++;
              resolveImage();
            } catch (error) {
              rejectImage(error);
            }
          };
          
          img.onerror = () => {
            rejectImage(new Error(`Failed to load image: ${imageFile.name}`));
          };
          
          img.src = e.target?.result as string;
        };
        
        reader.onerror = () => {
          rejectImage(new Error(`Failed to read file: ${imageFile.name}`));
        };
        
        reader.readAsDataURL(imageFile);
      });
    }

    if (!pdf) {
      throw new Error('Failed to create PDF');
    }

    // Convert PDF to blob (TypeScript assertion needed due to control flow)
    const pdfInstance: jsPDF = pdf as jsPDF;
    const pdfBlob = pdfInstance.output('blob');
    
    // Create a new File object with PDF extension
    const pdfFileName = `concatenated_${Date.now()}.pdf`;
    const pdfFile = new File([pdfBlob], pdfFileName, {
      type: 'application/pdf',
      lastModified: Date.now()
    });
    
    console.log(`✅ Created PDF with ${pageCount} pages`);
    return pdfFile;
  } catch (error) {
    throw error;
  }
}

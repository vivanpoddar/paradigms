# Debug Console Log Cleanup Summary

## Issue
The annotation layer props were being printed to the console repeatedly, causing spam in the console output.

## Root Causes Identified and Fixed

### 1. AnnotationLayer Props Debug Logging (FIXED)
- **File**: `components/pdf-annotations.tsx`
- **Issue**: `useEffect` was logging props on every change
- **Dependencies**: `[pageWidth, pageHeight, renderPageProps, annotations.length, isAnnotationMode]`
- **Action**: Removed the entire debug logging useEffect block

### 2. Extraction Debug Logging (FIXED)  
- **File**: `components/pdf-viewer-with-overlay.tsx`
- **Issue**: `useEffect` was logging extraction info on every prop change
- **Dependencies**: `[fileName, bucketName, uploadPath, userId, hasExtractionData, isExtractionLoading, extractionError, extractionResult]`
- **Action**: Removed the entire debug logging useEffect block

## Remaining Console Logs
These are intentionally kept as they only trigger on user actions, not on every render:

### Event-Based Logging (OK to keep)
- **pdf-annotations.tsx**: 
  - Selection coordinates (only when user makes selection)
  - Creating annotation (only when user creates annotation)
  - Selection too small warning (only when selection is invalid)

- **pdf-viewer-with-overlay.tsx**:
  - API responses for bounding boxes/annotations (only on data fetch)
  - Annotation creation (only when user creates annotation)
  - Missing user/fileName warnings (only when required data is missing)

- **use-extraction.ts**:
  - Missing parameters warning (only when hook is called with incomplete data)
  - API fetch progress (only when extraction is requested)
  - Success/error messages (only when API calls complete)

## Result
The repeated console logging should now be eliminated. Only user-action-triggered and API-response logs remain.

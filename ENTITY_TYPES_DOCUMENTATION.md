# Document AI Entity Types Collection

## Overview

This feature extracts and organizes all entity types from Google Document AI batch processing results into a single, comprehensive JSON file. The system identifies various document elements and categorizes them by type for easy analysis and processing.

## Extracted Entity Types

### 1. **Form Fields** (`form_field`)
- **Description**: Key-value pairs from form-like structures in documents
- **Examples**: Bill numbers, sponsor names, dates, titles
- **Structure**: 
  ```json
  {
    "type": "form_field",
    "name": "Field name/label",
    "value": "Field value/content",
    "page": 0
  }
  ```

### 2. **Legislative-Specific Entity Types**

#### **Sponsors** (`sponsors`)
- **Description**: Bill sponsors and co-sponsors
- **Examples**: "Rep. John Smith (R-TX)", "Sen. Jane Doe (D-CA)"

#### **Appropriations** (`appropriations`) 
- **Description**: Funding amounts and budget allocations
- **Examples**: "$50 million for border security", "$125.5 billion over 5 years"

#### **Amendments** (`amendments`)
- **Description**: References to amendments to existing laws
- **Examples**: "Section 123 of Immigration Act amendment"

#### **Definitions** (`definitions`)
- **Description**: Term definitions within the document
- **Examples**: "Border security technology", "Qualified immigrant"

#### **Effective Dates** (`effective_dates`)
- **Description**: When the legislation takes effect
- **Examples**: "January 1, 2025", "Upon enactment"

#### **Enforcement** (`enforcement`)
- **Description**: Enforcement mechanisms and penalties
- **Examples**: "Civil penalties up to $10,000", "Criminal prosecution"

#### **Congressional Session** (`congressional_session`)
- **Description**: Congressional session information
- **Examples**: "118th Congress", "2d Session"

#### **Bill Title** (`bill_title`)
- **Description**: Official title of the legislation
- **Examples**: "Comprehensive Immigration Reform Act of 2024"

#### **Committee References** (`committee_references`)
- **Description**: Congressional committees mentioned
- **Examples**: "Committee on Homeland Security", "Committee on the Judiciary"

### 3. **Document Structure Elements**

#### **Tables** (`table`)
- **Description**: Tabular data structures
- **Properties**: Row count, column count, page location
- **Structure**:
  ```json
  {
    "type": "table",
    "name": "Table 1",
    "rows": 5,
    "columns": 4,
    "page": 6
  }
  ```

#### **Paragraphs** (`paragraph`)
- **Description**: Document paragraphs with full text content
- **Properties**: Preview text (100 chars), full text, page location
- **Structure**:
  ```json
  {
    "type": "paragraph",
    "name": "Paragraph 1",
    "text": "Preview text...",
    "fullText": "Complete paragraph text",
    "page": 0
  }
  ```

#### **Lines** (`line`)
- **Description**: Individual text lines
- **Properties**: Line text content, page location
- **Structure**:
  ```json
  {
    "type": "line",
    "name": "Line 1",
    "text": "118th CONGRESS",
    "page": 0
  }
  ```

### 4. **Document-Level Entities** (`document_entity`)
- **Description**: Entities detected at the document level rather than page level
- **Properties**: Entity type, mention text, confidence score

## File Structure

### Main Sections

1. **Metadata**
   - Original filename
   - Processing date
   - Number of chunks processed
   - User ID

2. **Entity Types**
   - All entities organized by type
   - Each type contains an array of entities

3. **Entity Types Summary**
   - Count of each entity type
   - Examples from each type (up to 3)

4. **All Entities By Page**
   - Entities organized by page number
   - Useful for page-specific analysis

## Example Usage

### API Response
When processing completes, you'll receive:

```json
{
  "entityTypesCollection": {
    "fileName": "document_entity_types_collection.json",
    "filePath": "/tmp/document_entity_types_collection.json",
    "totalEntityTypes": 13,
    "totalEntities": 156,
    "entityTypesSummary": {
      "sponsors": {"count": 2, "examples": [...]},
      "appropriations": {"count": 5, "examples": [...]},
      "definitions": {"count": 8, "examples": [...]}
    }
  }
}
```

### File Output
The generated file will be named: `{originalFileName}_entity_types_collection.json`

## Entity Properties

### Common Properties
All entities include:
- `type`: Entity category
- `page`: Page number where found
- `chunkIndex`: Which PDF chunk contained this entity

### Entity-Specific Properties
- **Form Fields**: `name`, `value`
- **Legislative Entities**: `name`, `confidence`, `entityType`
- **Tables**: `rows`, `columns`
- **Paragraphs**: `text`, `fullText`
- **Lines**: `text`

## Benefits

1. **Comprehensive Extraction**: Captures all document elements in one place
2. **Organized Structure**: Easy to navigate and analyze by entity type
3. **Page Tracking**: Know exactly where each entity was found
4. **Chunk Mapping**: Understand which PDF chunk contained each entity
5. **Summary Statistics**: Quick overview of entity counts and examples

## Integration

This feature automatically runs as part of the batch PDF processing pipeline and requires no additional configuration. The entity types collection file is generated alongside the regular processing results.

## Supported Document Types

Optimized for legislative documents but works with any PDF that contains:
- Structured text
- Form fields
- Tables
- Clear paragraph divisions
- Defined sections

## File Locations

- **Local**: Saved to system temporary directory
- **Naming**: `{originalFileName}_entity_types_collection.json`
- **Access**: File path provided in API response

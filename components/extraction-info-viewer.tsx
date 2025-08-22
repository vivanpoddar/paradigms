'use client';

import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';

interface Entity {
  type: string;
  name: string;
  confidence?: number;
  page?: number;
  chunkIndex?: number;
  mentionText?: string;
  text?: string;
}

interface ExtractionData {
  entityTypes: {
    congressional_session?: Entity[];
    enacting_clause?: Entity[];
    effective_date?: Entity[];
    findings_purpose?: Entity[];
    Sponsor?: Entity[];
    sunset_clause?: Entity[];
    amendments_to_existing_law?: Entity[];
    appropriations?: Entity[];
    definitions?: Entity[];
    implementation_enforcement?: Entity[];
    provisions?: Entity[];
    bill_id?: Entity[];
    committee_references?: Entity[];
  };
  metadata?: {
    originalFileName?: string;
    processingDate?: string;
    totalChunksProcessed?: number;
    userId?: string;
  };
  entityTypesSummary?: Record<string, { count: number; examples: Entity[] }>;
  allEntitiesByPage?: Record<string, Entity[]>;
  [key: string]: unknown;
}

interface ExtractionInfoViewerProps {
  extractionData: ExtractionData | null;
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
}

const formatEntityTypeName = (type: string) => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const ExtractionInfoViewer: React.FC<ExtractionInfoViewerProps> = ({
  extractionData,
  isOpen,
  onClose,
  fileName
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<string | null>(null);

  if (!isOpen) return null;

  // Convert entityTypes structure to the format expected by the rest of the component
  const entityGroups: Record<string, Entity[]> = {};
  let totalEntityCount = 0;

  if (extractionData?.entityTypes) {
    Object.entries(extractionData.entityTypes).forEach(([type, entities]) => {
      if (Array.isArray(entities) && entities.length > 0) {
        entityGroups[type] = entities;
        totalEntityCount += entities.length;
      }
    });
  }

  // Get unique entity types for filtering
  const entityTypes = Object.keys(entityGroups).sort();

  // Filter entities based on selected type
  const filteredGroups = selectedEntityType
    ? { [selectedEntityType]: entityGroups[selectedEntityType] }
    : entityGroups;

  // Side panel version
  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-sm font-medium text-black">
            Extraction
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {fileName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-black"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {extractionData ? (
          <>
            {/* Entity count */}
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                {totalEntityCount} entities
              </p>
            </div>

            {/* Entity Type Filter */}
            {entityTypes.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedEntityType(null)}
                    className={`px-2 py-1 text-xs transition-colors ${
                      selectedEntityType === null
                        ? 'bg-black text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    All
                  </button>
                  {entityTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedEntityType(type)}
                      className={`px-2 py-1 text-xs transition-colors ${
                        selectedEntityType === type
                          ? 'bg-black text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {formatEntityTypeName(type)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Entities List */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {Object.keys(filteredGroups).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(filteredGroups).map(([type, entities]) => (
                    <div key={type}>
                      <h3 className="text-xs font-medium text-black mb-2">
                        {formatEntityTypeName(type)} ({entities.length})
                      </h3>
                      <div className="space-y-1">
                        {entities.map((entity: Entity, index: number) => {
                          const displayText = entity.name || entity.mentionText || entity.text || 'N/A';
                          return (
                            <div
                              key={`${type}-${index}`}
                              className="py-2 px-2 text-xs text-gray-800 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium">
                                {displayText}
                              </div>
                              {showDetails && entity.confidence && (
                                <div className="text-gray-500 mt-1">
                                  {(entity.confidence * 100).toFixed(0)}%
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs text-gray-500">
                    No entities found
                  </p>
                </div>
              )}
            </div>

            {/* Details toggle at bottom */}
            <div className="px-4 py-2 border-t border-gray-100">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-gray-500 hover:text-black"
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-xs text-gray-500">
              No extraction data
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

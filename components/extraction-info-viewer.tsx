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
  entityTypesSummary?: Record<string, { count: number; examples: any[] }>;
  allEntitiesByPage?: Record<string, Entity[]>;
  [key: string]: any;
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

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Document Extraction
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {fileName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showDetails ? 'Less' : 'Details'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {extractionData ? (
            <>
              {/* Document Info Section */}
              {extractionData.metadata && (
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{extractionData.metadata.originalFileName}</span>
                    <span>{totalEntityCount} entities</span>
                  </div>
                </div>
              )}

              {/* Entity Type Filter */}
              {entityTypes.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedEntityType(null)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        selectedEntityType === null
                          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                      }`}
                    >
                      All ({totalEntityCount})
                    </button>
                    {entityTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedEntityType(type)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          selectedEntityType === type
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                        }`}
                      >
                        {formatEntityTypeName(type)} ({entityGroups[type]?.length || 0})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Entities List */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {Object.keys(filteredGroups).length > 0 ? (
                  <div className="space-y-8">
                    {Object.entries(filteredGroups).map(([type, entities]) => (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatEntityTypeName(type)}
                          </h3>
                          <span className="text-xs text-gray-400">
                            {entities.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {entities.map((entity: Entity, index: number) => {
                            const displayText = entity.name || entity.mentionText || entity.text || 'N/A';
                            return (
                              <div
                                key={`${type}-${index}`}
                                className="py-2 px-3 rounded-md bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <div className="text-sm text-gray-900 dark:text-white">
                                  {displayText}
                                </div>
                                {showDetails && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-x-3">
                                    {entity.confidence && (
                                      <span>{(entity.confidence * 100).toFixed(0)}%</span>
                                    )}
                                    {entity.page !== undefined && entity.page >= 0 && (
                                      <span>Page {entity.page}</span>
                                    )}
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
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No entities found
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 mx-auto">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No extraction data available
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

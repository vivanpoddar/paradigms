import * as React from 'react';
import { ChevronDown, ChevronRight, FileText, Info, Calendar, Building, DollarSign, BookOpen, Shield, AlertCircle, Users, Sunset } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

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

interface ExtractionInfoMenuProps {
  extractionResult: ExtractionResult;
  isOpen: boolean;
  onToggle: () => void;
}

interface TreeNodeProps {
  label: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  count?: number;
  defaultExpanded?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({ label, icon, children, count, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div className="select-none">
      <div 
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        ) : (
          <div className="w-4" />
        )}
        {icon && <span className="text-gray-600 dark:text-gray-400">{icon}</span>}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {count !== undefined && (
          <Badge variant="outline" className="ml-auto text-xs">
            {count}
          </Badge>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-6 border-l border-gray-200 dark:border-gray-700 pl-2">
          {children}
        </div>
      )}
    </div>
  );
};

const LeafNode: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-start gap-2 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
    <div className="w-4" />
    {icon && <span className="text-gray-500 dark:text-gray-500 mt-0.5">{icon}</span>}
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 dark:text-gray-200 break-words">{value}</div>
    </div>
  </div>
);

export const ExtractionInfoMenu: React.FC<ExtractionInfoMenuProps> = ({
  extractionResult,
  isOpen,
  onToggle
}) => {
  const hasAnyData = extractionResult && Object.keys(extractionResult).length > 0;
  
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Show Extraction Results"
      >
        <Info size={20} />
      </button>
    );
  }

  return (
    <div className="fixed top-4 right-4 w-96 max-h-[calc(100vh-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileText size={20} />
          Extraction Results
        </h3>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-8rem)] p-2">
        {!hasAnyData ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <FileText size={48} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No extraction data available</p>
            <p className="text-xs mt-1">Process the document first to see extracted information</p>
          </div>
        ) : (
          <>
            {/* Bill Information */}
            {(extractionResult.bill_id || extractionResult.congressional_session) && (
              <TreeNode label="Bill Information" icon={<FileText size={16} />} defaultExpanded>
                {extractionResult.bill_id && (
                  <LeafNode label="Bill ID" value={extractionResult.bill_id} />
                )}
                {extractionResult.congressional_session && (
                  <LeafNode label="Congressional Session" value={extractionResult.congressional_session} />
                )}
              </TreeNode>
            )}

        {/* Sponsor */}
        {extractionResult.sponsor && (
          <TreeNode label="Sponsor" icon={<Users size={16} />} defaultExpanded>
            <LeafNode label="Name" value={extractionResult.sponsor.name} />
            <LeafNode label="Party" value={extractionResult.sponsor.party} />
            <LeafNode label="State" value={extractionResult.sponsor.state} />
          </TreeNode>
        )}

        {/* Amendments to Existing Law */}
        {extractionResult.amendments_to_existing_law && extractionResult.amendments_to_existing_law.length > 0 && (
          <TreeNode 
            label="Amendments to Existing Law" 
            icon={<BookOpen size={16} />} 
            count={extractionResult.amendments_to_existing_law.length}
          >
            {extractionResult.amendments_to_existing_law.map((amendment, index) => (
              <TreeNode key={index} label={`Amendment ${index + 1}`}>
                <LeafNode label="Law Reference" value={amendment.law_reference} />
                <LeafNode label="Modification" value={amendment.modification} />
              </TreeNode>
            ))}
          </TreeNode>
        )}

        {/* Appropriations */}
        {extractionResult.appropriations && extractionResult.appropriations.length > 0 && (
          <TreeNode 
            label="Appropriations" 
            icon={<DollarSign size={16} />} 
            count={extractionResult.appropriations.length}
          >
            {extractionResult.appropriations.map((appropriation, index) => (
              <TreeNode key={index} label={`Appropriation ${index + 1}`}>
                <LeafNode label="Amount" value={appropriation.amount} />
                <LeafNode label="Purpose" value={appropriation.purpose} />
              </TreeNode>
            ))}
          </TreeNode>
        )}

        {/* Definitions */}
        {extractionResult.definitions && extractionResult.definitions.length > 0 && (
          <TreeNode 
            label="Definitions" 
            icon={<BookOpen size={16} />} 
            count={extractionResult.definitions.length}
          >
            {extractionResult.definitions.map((definition, index) => (
              <TreeNode key={index} label={definition.term}>
                <LeafNode label="Meaning" value={definition.meaning} />
              </TreeNode>
            ))}
          </TreeNode>
        )}

        {/* Provisions */}
        {extractionResult.provisions && extractionResult.provisions.length > 0 && (
          <TreeNode 
            label="Provisions" 
            icon={<FileText size={16} />} 
            count={extractionResult.provisions.length}
          >
            {extractionResult.provisions.map((provision, index) => (
              <TreeNode key={index} label={provision.heading || `Section ${provision.section_number}`}>
                {provision.section_number && (
                  <LeafNode label="Section Number" value={provision.section_number} />
                )}
                <LeafNode label="Text" value={provision.text} />
              </TreeNode>
            ))}
          </TreeNode>
        )}

        {/* Implementation & Enforcement */}
        {extractionResult.implementation_enforcement && (
          <TreeNode label="Implementation & Enforcement" icon={<Shield size={16} />} defaultExpanded>
            <LeafNode label="Agency" value={extractionResult.implementation_enforcement.agency} />
            <LeafNode label="Penalties" value={extractionResult.implementation_enforcement.penalties} />
            <LeafNode label="Responsibilities" value={extractionResult.implementation_enforcement.responsibilities} />
          </TreeNode>
        )}

        {/* Key Dates & Clauses */}
        {(extractionResult.effective_date || extractionResult.sunset_clause || extractionResult.enacting_clause) && (
          <TreeNode label="Key Dates & Clauses" icon={<Calendar size={16} />} defaultExpanded>
            {extractionResult.effective_date && (
              <LeafNode label="Effective Date" value={extractionResult.effective_date} />
            )}
            {extractionResult.sunset_clause && (
              <LeafNode label="Sunset Clause" value={extractionResult.sunset_clause} icon={<Sunset size={14} />} />
            )}
            {extractionResult.enacting_clause && (
              <LeafNode label="Enacting Clause" value={extractionResult.enacting_clause} />
            )}
          </TreeNode>
        )}

        {/* Additional Information */}
        {(extractionResult.findings_purpose || extractionResult.notes || extractionResult.miscellaneous) && (
          <TreeNode label="Additional Information" icon={<Info size={16} />}>
            {extractionResult.findings_purpose && (
              <LeafNode label="Findings & Purpose" value={extractionResult.findings_purpose} />
            )}
            {extractionResult.notes && (
              <LeafNode label="Notes" value={extractionResult.notes} />
            )}
            {extractionResult.miscellaneous && (
              <LeafNode label="Miscellaneous" value={extractionResult.miscellaneous} />
            )}
          </TreeNode>
        )}
        </>
        )}
      </div>
    </div>
  );
};

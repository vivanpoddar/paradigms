import * as React from 'react';
import { Highlighter, Type, MessageSquare, Palette, X } from 'lucide-react';

interface AnnotationMenuProps {
    isAnnotationMode: boolean;
    onToggleAnnotationMode: () => void;
    selectedAnnotationType: 'highlight' | 'note' | 'comment';
    onAnnotationTypeChange: (type: 'highlight' | 'note' | 'comment') => void;
    selectedColor: string;
    onColorChange: (color: string) => void;
}

export const AnnotationMenu: React.FC<AnnotationMenuProps> = ({
    isAnnotationMode,
    onToggleAnnotationMode,
    selectedAnnotationType,
    onAnnotationTypeChange,
    selectedColor,
    onColorChange
}) => {
    const colors = [
        { color: '#fbbf24', name: 'Yellow' },
        { color: '#f87171', name: 'Red' },
        { color: '#60a5fa', name: 'Blue' },
        { color: '#34d399', name: 'Green' },
        { color: '#a78bfa', name: 'Purple' },
        { color: '#fb7185', name: 'Pink' },
        { color: '#f97316', name: 'Orange' },
    ];

    const annotationTypes = [
        { type: 'highlight' as const, icon: Highlighter, name: 'Highlight' },
        { type: 'note' as const, icon: Type, name: 'Note' },
        { type: 'comment' as const, icon: MessageSquare, name: 'Comment' },
    ];

    return (
        <div className="flex items-center gap-4">
            {/* Annotation type selector */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Type:</span>
                <div className="flex items-center gap-1">
                    {annotationTypes.map(({ type, icon: Icon, name }) => (
                        <button
                            key={type}
                            onClick={() => onAnnotationTypeChange(type)}
                            className={`p-2 rounded-md transition-colors ${
                                selectedAnnotationType === type
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                            }`}
                            title={name}
                        >
                            <Icon className="w-4 h-4" />
                        </button>
                    ))}
                </div>
            </div>

            {/* Color picker */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Color:</span>
                <div className="flex items-center gap-1">
                    {colors.map(({ color, name }) => (
                        <button
                            key={color}
                            onClick={() => onColorChange(color)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                                selectedColor === color
                                    ? 'border-gray-800 dark:border-white scale-110 ring-2 ring-gray-300 dark:ring-gray-600'
                                    : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                            title={name}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

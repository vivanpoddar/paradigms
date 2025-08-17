'use client'

import { useFileManager } from './use-file-manager';

/**
 * A simple hook that provides only the file refresh functionality.
 * Useful for components that need to trigger file list refresh but don't need the full file state.
 */
export const useFileRefresh = () => {
  const { refreshFiles } = useFileManager();
  
  return {
    refreshFiles,
  };
};

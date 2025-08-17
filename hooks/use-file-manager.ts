'use client'

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useCallback } from "react";

const supabase = createClient();

interface FileItem {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any>;
}

export interface UseFileManagerReturn {
  files: FileItem[];
  loading: boolean;
  userId: string | null;
  loadFiles: (userUuid?: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  addNewFile: (newFile: FileItem) => void;
  removeFile: (fileId: string) => void;
}

export const useFileManager = (): UseFileManagerReturn => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLoadedFiles, setHasLoadedFiles] = useState(false);

  const loadFiles = useCallback(async (userUuid?: string) => {
    const targetUserId = userUuid || userId;
    if (!targetUserId || loading) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .list(targetUserId, {
          limit: 100,
          offset: 0,
        });

      if (error) {
        console.error('Error loading files:', error);
      } else {
        const fileList = data || [];
        setFiles(fileList);
        console.log(`✅ Loaded ${fileList.length} files for user`);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, loading]);

  const refreshFiles = useCallback(async () => {
    if (userId) {
      await loadFiles(userId);
    }
  }, [userId, loadFiles]);

  const addNewFile = useCallback((newFile: FileItem) => {
    setFiles(prevFiles => {
      // Check if file already exists to avoid duplicates
      const exists = prevFiles.some(file => file.name === newFile.name);
      if (exists) {
        return prevFiles;
      }
      return [...prevFiles, newFile];
    });
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
  }, []);

  // Get current user and load files only once
  useEffect(() => {
    const loadUserFiles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Only load files if we haven't loaded them yet for any user
        if (!hasLoadedFiles) {
          await loadFiles(user.id);
          setHasLoadedFiles(true);
        }
      }
    };
    loadUserFiles();
  }, []); // Empty dependency array ensures this runs only once

  // Listen for auth state changes to reload files when user logs in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        await loadFiles(session.user.id);
        setHasLoadedFiles(true);
      } else if (event === 'SIGNED_OUT') {
        setFiles([]);
        setUserId(null);
        setHasLoadedFiles(false); // Reset the flag when user signs out
      }
    });

    return () => subscription.unsubscribe();
  }, [loadFiles]);

  return {
    files,
    loading,
    userId,
    loadFiles,
    refreshFiles,
    addNewFile,
    removeFile,
  };
};

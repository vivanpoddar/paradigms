-- SQL script to create the annotations table in Supabase
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS annotations (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    document_name TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    text TEXT,
    color TEXT DEFAULT '#fbbf24',
    type TEXT DEFAULT 'highlight' CHECK (type IN ('highlight', 'note', 'comment')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own annotations
CREATE POLICY "Users can view their own annotations" ON annotations
    FOR SELECT USING (auth.uid()::text = user_id);

-- Policy to allow users to insert their own annotations
CREATE POLICY "Users can insert their own annotations" ON annotations
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Policy to allow users to update their own annotations
CREATE POLICY "Users can update their own annotations" ON annotations
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Policy to allow users to delete their own annotations
CREATE POLICY "Users can delete their own annotations" ON annotations
    FOR DELETE USING (auth.uid()::text = user_id);

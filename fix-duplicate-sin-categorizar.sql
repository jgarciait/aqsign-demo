-- Fix duplicate "Sin Categorizar" categories issue
-- Problem: Two different triggers are creating the same default category

-- Step 1: Remove duplicate triggers to prevent future duplicates
-- Keep only the newer trigger (trigger_create_default_category_simple)
DROP TRIGGER IF EXISTS trigger_create_default_category ON file_records;
DROP FUNCTION IF EXISTS create_default_category_for_file_record();

-- Ensure the correct trigger is in place
DROP TRIGGER IF EXISTS trigger_create_default_category_simple ON file_records;

CREATE OR REPLACE FUNCTION create_default_category_for_new_file_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create the default category if it doesn't already exist
  -- This prevents duplicates even if multiple triggers somehow run
  INSERT INTO document_categories (
    id,
    file_record_id,
    name,
    description,
    color,
    icon,
    sort_order,
    created_by,
    created_at,
    updated_at
  ) 
  SELECT 
    gen_random_uuid(),
    NEW.id,
    'Sin Categorizar',
    'Documentos sin categoría específica',
    '#6B7280',
    'inbox',
    0,
    NEW.created_by,
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM document_categories 
    WHERE file_record_id = NEW.id 
    AND name = 'Sin Categorizar'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the single trigger
CREATE TRIGGER trigger_create_default_category_simple
  AFTER INSERT ON file_records
  FOR EACH ROW
  EXECUTE FUNCTION create_default_category_for_new_file_record();

-- Step 2: Clean up existing duplicate "Sin Categorizar" categories
-- For each file_record that has multiple "Sin Categorizar" categories, keep only one

-- First, identify file_records with duplicate "Sin Categorizar" categories
WITH duplicate_categories AS (
  SELECT 
    file_record_id,
    COUNT(*) as category_count,
    array_agg(id ORDER BY created_at) as category_ids
  FROM document_categories 
  WHERE name = 'Sin Categorizar'
  GROUP BY file_record_id
  HAVING COUNT(*) > 1
),
categories_to_keep AS (
  SELECT 
    file_record_id,
    category_ids[1] as keep_category_id,
    category_ids[2:] as delete_category_ids
  FROM duplicate_categories
),
documents_to_update AS (
  -- Move all documents from duplicate categories to the main category
  UPDATE documents 
  SET 
    category_id = ctk.keep_category_id,
    updated_at = NOW()
  FROM categories_to_keep ctk
  WHERE documents.category_id = ANY(ctk.delete_category_ids)
  RETURNING documents.id, documents.category_id, ctk.file_record_id
)
-- Delete the duplicate categories (after moving documents)
DELETE FROM document_categories 
WHERE id IN (
  SELECT unnest(delete_category_ids) 
  FROM categories_to_keep
);

-- Step 3: Add unique constraint to prevent future duplicates
-- This ensures that even if something goes wrong, we can't have duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_sin_categorizar_per_file_record 
ON document_categories(file_record_id) 
WHERE name = 'Sin Categorizar';

-- Step 4: Verify the fix
-- Show the current state of "Sin Categorizar" categories
SELECT 
  fr.id as file_record_id,
  COUNT(dc.id) as sin_categorizar_count,
  STRING_AGG(dc.id::text, ', ') as category_ids
FROM file_records fr
LEFT JOIN document_categories dc ON fr.id = dc.file_record_id AND dc.name = 'Sin Categorizar'
GROUP BY fr.id
HAVING COUNT(dc.id) > 1
ORDER BY fr.id;

-- If the above query returns no rows, the duplicates have been cleaned up successfully
SELECT 
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM file_records fr
      LEFT JOIN document_categories dc ON fr.id = dc.file_record_id AND dc.name = 'Sin Categorizar'
      GROUP BY fr.id
      HAVING COUNT(dc.id) > 1
    ) THEN 'STILL HAS DUPLICATES - Manual intervention needed'
    ELSE 'SUCCESS - No duplicate "Sin Categorizar" categories found'
  END as status; 
-- Remove automatic creation of "Sin Categorizar" categories
-- This script eliminates the trigger that automatically creates the default category

-- Step 1: Drop the trigger that creates "Sin Categorizar" categories automatically
DROP TRIGGER IF EXISTS trigger_create_default_category_simple ON file_records;
DROP TRIGGER IF EXISTS trigger_create_default_category ON file_records;

-- Step 2: Drop the functions that create default categories
DROP FUNCTION IF EXISTS create_default_category_for_new_file_record();
DROP FUNCTION IF EXISTS create_default_category_for_file_record();

-- Step 3: Remove the unique constraint that was created for "Sin Categorizar"
DROP INDEX IF EXISTS idx_unique_sin_categorizar_per_file_record;

-- Step 4: Optional - Remove existing "Sin Categorizar" categories
-- Uncomment the following lines if you want to delete existing "Sin Categorizar" categories
-- WARNING: This will move all documents in these categories to have NULL category_id

-- First, set all documents in "Sin Categorizar" categories to have no category
-- UPDATE documents 
-- SET category_id = NULL, updated_at = NOW()
-- WHERE category_id IN (
--   SELECT id FROM document_categories WHERE name = 'Sin Categorizar'
-- );

-- Then delete all "Sin Categorizar" categories
-- DELETE FROM document_categories WHERE name = 'Sin Categorizar';

-- Step 5: Verify the changes
SELECT 
  'SUCCESS - Automatic "Sin Categorizar" creation has been disabled' as status;

-- Show current state (should show no triggers related to default category creation)
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%default_category%' 
   OR trigger_name LIKE '%create_default%'
   OR action_statement LIKE '%Sin Categorizar%';

-- Show remaining "Sin Categorizar" categories (if any)
SELECT 
  COUNT(*) as remaining_sin_categorizar_categories
FROM document_categories 
WHERE name = 'Sin Categorizar'; 
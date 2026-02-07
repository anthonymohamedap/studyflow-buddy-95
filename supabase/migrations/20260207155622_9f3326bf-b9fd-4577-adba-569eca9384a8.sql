-- Update the lab_assets check constraint to include 'how_to' asset type
ALTER TABLE public.lab_assets DROP CONSTRAINT lab_assets_asset_type_check;

ALTER TABLE public.lab_assets ADD CONSTRAINT lab_assets_asset_type_check 
CHECK (asset_type = ANY (ARRAY['summary'::text, 'approach_plan'::text, 'checklist'::text, 'key_terms'::text, 'how_to'::text]));
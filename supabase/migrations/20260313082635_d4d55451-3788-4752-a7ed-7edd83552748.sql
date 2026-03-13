UPDATE theory_topics SET parsing_status = 'pending', parsing_error = NULL WHERE parsing_status = 'parsing';

UPDATE theory_topics 
SET file_path = replace(
  split_part(source_url, '/storage/v1/object/public/course-materials/', 2),
  '%20', ' '
)
WHERE file_path IS NULL 
AND source_url LIKE '%/storage/v1/object/public/course-materials/%';
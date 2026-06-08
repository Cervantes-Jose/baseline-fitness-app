import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xbvncbvoyatxbdhkkifq.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhidm5jYnZveWF0eGJkaGtraWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTQzNzgsImV4cCI6MjA5NDk3MDM3OH0.rMAoMAlVvaAgfcAM4um750S-ZFXLccVy45OGe2-VHl0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
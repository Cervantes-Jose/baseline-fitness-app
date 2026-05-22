import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xbvncbvoyatxbdhkkifq.supabase.co';
const supabaseAnonKey = 'sb_publishable_uSmsJmmJXkDrOUGKIObNdw_a_DVPrQN';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
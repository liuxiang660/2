import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key';

// Log environment status
if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_ANON_KEY)) {
  console.warn('⚠️  Supabase environment variables not configured');
  console.warn('   Database operations will fail until .env.local is properly set');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export async function testConnection() {
  try {
    const { data, error, count } = await supabase
      .from('user_account')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Database connection error:', error);
      return false;
    }

    console.log('✓ Database connection successful, user_account has', count, 'records');
    return true;
  } catch (err) {
    console.error('Connection test failed:', err);
    return false;
  }
}

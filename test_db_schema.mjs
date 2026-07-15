import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('transactions')
  .insert([{
    date: '2026-07-15',
    description: 'Test Source Auto',
    amount: 10,
    type: 'debit',
    category: 'Investment',
    source: 'auto',
    gmail_msg_id: 'test_auto_source'
  }]);
console.log("Insert response:", data, error);

await supabase.from('transactions').delete().eq('gmail_msg_id', 'test_auto_source');

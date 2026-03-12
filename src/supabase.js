import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fxwcigukzlmmczmbyjki.supabase.co'
const supabaseKey = 'sb_publishable_UrZ-TX1Sz7H5C-NZn7Bfng_T-6TPmvH'

export const supabase = createClient(supabaseUrl, supabaseKey)

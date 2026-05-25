// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js";

const supabase_url = Deno.env.get("SUPABASE_URL") ?? "";
const supabase_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabase_url || !supabase_key) {
  console.error("[KV Store] Critical: Missing Supabase environment variables.");
}

const supabase = createClient(supabase_url, supabase_key);

const handleDbError = (error, context) => {
  console.error(`Database error in ${context}:`, error.message);
  return null;
};

export const set = async (key, value) => {
  try {
    const { error } = await supabase.from("kv_store_a834b74a").upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    });
    if (error) handleDbError(error, 'set');
  } catch (err) {
    console.error("Critical error in kv.set:", err.message);
  }
};

export const get = async (key) => {
  try {
    const { data, error } = await supabase
      .from("kv_store_a834b74a")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      handleDbError(error, 'get');
      return null;
    }
    return data?.value;
  } catch (err) {
    console.error("Critical error in kv.get:", err.message);
    return null;
  }
};

export const del = async (key) => {
  try {
    const { error } = await supabase.from("kv_store_a834b74a").delete().eq("key", key);
    if (error) handleDbError(error, 'del');
  } catch (err) {
    console.error("Critical error in kv.del:", err.message);
  }
};
// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js";

const supabase_url = Deno.env.get("SUPABASE_URL") ?? "";
const service_role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anon_key = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

if (!supabase_url || !service_role || !anon_key) {
  console.error("[Auth] Critical: Missing Supabase environment variables.");
}

const supabaseAdmin = createClient(supabase_url, service_role);
const supabaseClient = createClient(supabase_url, anon_key);

export async function signUp(email: string, password: string, name: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    throw new Error(`Sign up error: ${err.message}`);
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    throw new Error(`Sign in error: ${err.message}`);
  }
}

export async function verifyToken(token: string) {
  try {
    const { data, error } = await supabaseClient.auth.getUser(token);

    if (error) throw new Error(error.message);
    return data.user;
  } catch (err) {
    throw new Error(`Token verification error: ${err.message}`);
  }
}

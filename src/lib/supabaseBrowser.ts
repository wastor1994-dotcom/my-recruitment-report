"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_PDFS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_PDFS_BUCKET ?? "rate-pdfs";

export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}

export function getPdfsBucketName() {
  return SUPABASE_PDFS_BUCKET;
}


import { supabase } from "../lib/supabaseClient.js";

const REVIEWERS_TABLE = "reviewers";

export async function listMyCloudReviewers(userId) {
  if (!supabase || !userId) return { data: [], error: null };

  const { data, error } = await supabase
    .from(REVIEWERS_TABLE)
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  return { data: data || [], error };
}

export async function upsertCloudReviewer(userId, reviewer) {
  if (!supabase || !userId) {
    return { data: null, error: new Error("Supabase is not configured.") };
  }

  const payload = {
    owner_id: userId,
    reviewer_id: reviewer.reviewerId,
    title: reviewer.title,
    subject: reviewer.subject,
    data: reviewer,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(REVIEWERS_TABLE)
    .upsert(payload, { onConflict: "owner_id,reviewer_id" })
    .select()
    .single();

  return { data, error };
}

export async function deleteCloudReviewer(userId, reviewerId) {
  if (!supabase || !userId) {
    return { error: new Error("Supabase is not configured.") };
  }

  const { error } = await supabase
    .from(REVIEWERS_TABLE)
    .delete()
    .eq("owner_id", userId)
    .eq("reviewer_id", reviewerId);

  return { error };
}

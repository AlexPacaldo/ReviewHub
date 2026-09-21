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

function getSharingScope(reviewer) {
  return Array.isArray(reviewer.sharedWith) && reviewer.sharedWith.length
    ? reviewer.sharedWith
    : null;
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
    visibility: reviewer.visibility === "private" ? "private" : "friends",
    shared_with: getSharingScope(reviewer),
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

export async function getMyCloudReviewer(userId, reviewerId) {
  if (!supabase || !userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from(REVIEWERS_TABLE)
    .select("*")
    .eq("owner_id", userId)
    .eq("reviewer_id", reviewerId)
    .maybeSingle();

  return { data, error };
}

export async function listVisibleCloudReviewers(userId) {
  if (!supabase || !userId) return { data: [], error: null };

  const { data: friendships, error: friendshipsError } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (friendshipsError) return { data: [], error: friendshipsError };

  const friendIds = [
    ...new Set((friendships || [])
      .filter((friendship) => friendship.status === "accepted")
      .flatMap((friendship) => {
        const otherId = friendship.requester_id === userId
          ? friendship.addressee_id
          : friendship.requester_id;
        return otherId !== userId ? [otherId] : [];
      }))
  ];

  const query = supabase.from(REVIEWERS_TABLE).select("*");

  const builtQuery = friendIds.length
    ? query.or(`owner_id.eq.${userId},owner_id.in.(${friendIds.join(",")})`)
    : query.eq("owner_id", userId);

  const { data: rows, error } = await builtQuery.order("updated_at", { ascending: false });

  if (error) return { data: [], error };

  const ownerIds = [...new Set((rows || []).map((row) => row.owner_id))];
  const { data: profiles, error: profilesError } = ownerIds.length
    ? await supabase.from("profiles").select("id, email, display_name").in("id", ownerIds)
    : { data: [], error: null };

  if (profilesError) return { data: [], error: profilesError };

  const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  return {
    data: (rows || []).map((row) => {
      const profile = row.owner_id === userId ? null : profilesById.get(row.owner_id) || null;

      return {
        ...row,
        ownerName: profile ? profile.display_name || profile.email || "A friend" : null,
        ownerProfile: profile
      };
    }),
    error: null
  };
}

export async function updateCloudReviewerVisibility(userId, reviewerId, { visibility, sharedWith }) {
  if (!supabase || !userId) {
    return { data: null, error: new Error("Supabase is not configured.") };
  }

  const payload = {
    visibility: visibility === "private" ? "private" : "friends",
    shared_with: Array.isArray(sharedWith) && sharedWith.length ? sharedWith : null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(REVIEWERS_TABLE)
    .update(payload)
    .eq("owner_id", userId)
    .eq("reviewer_id", reviewerId)
    .select()
    .single();

  return { data, error };
}

export async function checkReviewerSharingReady(userId) {
  if (!supabase || !userId) return { ready: false, error: null };

  const { error } = await supabase
    .from(REVIEWERS_TABLE)
    .select("visibility")
    .eq("owner_id", userId)
    .limit(1);

  return { ready: !error, error };
}

import { supabase } from "./supabase";
import { getErrorMessage } from "./db";

if (!supabase) {
  console.warn("Supabase client not configured. Auth helpers will be disabled.");
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data;
}

export async function signOutUser() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getUserSession() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.session;
}

export async function getUser() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.user;
}

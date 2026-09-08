const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  image_url: string | null;
  category_id: string | null;
  published: boolean;
  meta_description: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...options,
    credentials: "include",
    headers: options.body instanceof FormData
      ? options.headers
      : { "Content-Type": "application/json", ...options.headers },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.error || "No se pudo completar la solicitud", response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const assetUrl = (value: string | null) => {
  if (!value || /^https?:\/\//i.test(value)) return value || "";
  return `${API_ORIGIN}${value}`;
};

export const authApi = {
  login: (email: string, password: string) => apiFetch<{ user: { id: string; email: string; role: string } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
  ),
  logout: () => apiFetch<void>("/api/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ user: { id: string; email: string; role: string } }>("/api/auth/me"),
};

export const postsApi = {
  listPublic: async () => (await apiFetch<{ posts: Post[] }>("/api/posts")).posts,
  getPublic: async (slug: string) => (await apiFetch<{ post: Post }>(`/api/posts/${encodeURIComponent(slug)}`)).post,
  listAdmin: async () => (await apiFetch<{ posts: Post[] }>("/api/admin/posts")).posts,
  create: async (formData: FormData) => (await apiFetch<{ post: Post }>("/api/admin/posts", {
    method: "POST",
    body: formData,
  })).post,
  update: async (id: string, formData: FormData) => (await apiFetch<{ post: Post }>(`/api/admin/posts/${id}`, {
    method: "PUT",
    body: formData,
  })).post,
  remove: (id: string) => apiFetch<void>(`/api/admin/posts/${id}`, { method: "DELETE" }),
};

export const commentsApi = {
  list: async (postId: string) => (await apiFetch<{ comments: Comment[] }>(`/api/posts/${postId}/comments`)).comments,
  create: async (postId: string, input: { author_name: string; author_email: string; content: string }) => (
    await apiFetch<{ comment: Comment }>(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).comment,
};

import axios, { AxiosError } from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, 
});

export function getApiErrorMessage(error: unknown, fallback = "Request failed") {
  if (axios.isAxiosError(error)) {
    const data = (error as AxiosError<{ error?: string; message?: string }>).response?.data;
    return data?.error ?? data?.message ?? error.message ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export default api;

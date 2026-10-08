import { api } from "./api";

/**
 * Downloads an authenticated API file. A plain <a href> wouldn't carry the
 * session cookie cross-origin, so this fetches a blob through the shared axios
 * instance and saves it, using the server's Content-Disposition filename.
 */
export async function downloadFromApi(path: string, fallbackName: string): Promise<void> {
  const response = await api.get<Blob>(path, { responseType: "blob" });
  const header = String(response.headers["content-disposition"] ?? "");
  const name = /filename="([^"]+)"/.exec(header)?.[1] ?? fallbackName;

  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

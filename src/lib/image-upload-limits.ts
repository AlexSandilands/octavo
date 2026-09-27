// The editor's image upload limits, shared by the route and the clients that
// check a file before sending it (the assistant's attachments, #343), so a
// refusal reads the same wherever it's made.

export const IMAGE_UPLOAD_MAX_BYTES = 12 * 1024 * 1024; // 12 MB raw upload
export const IMAGE_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
export const IMAGE_TOO_LARGE = "Image is too large (max 12 MB).";
export const IMAGE_UNSUPPORTED = "Unsupported image type.";

/** Why a file would be refused, judged from its size and declared type; null if not. */
export function imageUploadRefusal(file: { size: number; type: string }) {
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) return IMAGE_TOO_LARGE;
  if (file.type && !IMAGE_UPLOAD_TYPES.includes(file.type))
    return IMAGE_UNSUPPORTED;
  return null;
}

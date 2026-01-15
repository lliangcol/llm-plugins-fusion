import { Attachment } from '../types';

interface AttachmentReadOptions {
  maxBytes: number;
  snippetLimit: number;
  onError?: (filename: string, error: unknown) => void;
}

export const readAttachments = async (
  files: FileList | null,
  { maxBytes, snippetLimit, onError }: AttachmentReadOptions,
): Promise<Attachment[]> => {
  if (!files) return [];
  const next: Attachment[] = [];
  for (const file of Array.from(files)) {
    try {
      const text = await file.slice(0, maxBytes).text();
      next.push({ name: file.name, content: text.slice(0, snippetLimit) });
    } catch (error) {
      onError?.(file.name, error);
    }
  }
  return next;
};

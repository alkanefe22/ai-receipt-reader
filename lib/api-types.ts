import type { PipelineResult } from "@/lib/pipeline";

/** Wire format of POST /api/extract — shared by the route and the client. */
export type ExtractSuccess = PipelineResult & {
  id: string;
  fileName: string;
  mediaType: string;
  /** "replay" = recorded demo responses, no model was called. */
  source: "live" | "replay";
  models: { a: string; b: string; arbiter: string } | null;
};

export type ExtractErrorCode =
  | "bad_request"
  | "unknown_sample"
  | "demo_upload_disabled"
  | "rate_limited"
  | "file_too_large"
  | "unsupported_type"
  | "pdf_unreadable"
  | "pdf_empty"
  | "pdf_not_supported_by_model"
  | "extraction_failed";

export type ExtractFailure = {
  error: { code: ExtractErrorCode; message: string; retryAfterSeconds?: number };
};

export type ExtractResponse = ExtractSuccess | ExtractFailure;

import { describe, it, expect } from "vitest";
import {
  normalizeMimeType,
  presignBodySchema,
  createAttachmentSchema,
  MAX_FILE_SIZE,
} from "./uploads";

describe("uploads validation", () => {
  it("normalizes allowed MIME types", () => {
    expect(normalizeMimeType("image/jpg")).toBe("image/jpeg");
    expect(normalizeMimeType("image/jpeg")).toBe("image/jpeg");
    expect(normalizeMimeType("image/png")).toBe("image/png");
    expect(normalizeMimeType("application/pdf")).toBe("application/pdf");
  });
  it("detects from extension when missing type", () => {
    expect(normalizeMimeType("", "doc.PDF")).toBe("application/pdf");
    expect(normalizeMimeType("", "photo.JPG")).toBe("image/jpeg");
    expect(normalizeMimeType("", "img.png")).toBe("image/png");
  });
  it("rejects unsupported types", () => {
    expect(normalizeMimeType("text/plain", "note.txt")).toBeNull();
    expect(normalizeMimeType("", "archive.zip")).toBeNull();
  });
  it("zod schema enforces max size", () => {
    const base = {
      fileName: "a.pdf",
      fileSize: 123,
      mimeType: "application/pdf",
      entryId: "b2d7c2cd-8d8c-4f03-b224-2c2f9b5e9f7b",
    };
    expect(presignBodySchema.safeParse(base).success).toBe(true);
    const tooBig = { ...base, fileSize: MAX_FILE_SIZE + 1 };
    expect(presignBodySchema.safeParse(tooBig).success).toBe(false);
  });
  it("createAttachment schema ok", () => {
    const base = {
      entryId: "b2d7c2cd-8d8c-4f03-b224-2c2f9b5e9f7b",
      fileName: "a.pdf",
      fileSize: 99,
      mimeType: "application/pdf",
      storageKey: "k",
    };
    expect(createAttachmentSchema.safeParse(base).success).toBe(true);
  });
});

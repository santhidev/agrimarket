import { describe, it, expect } from "vitest";
import {
  createKycSubmissionSchema,
  rejectKycSubmissionSchema,
  kycSubmissionSchema,
  KycSubmissionStatus,
} from "./kyc-schemas";

const validPhoto = {
  url: "https://kf4497ix.ap-southeast.insforge.app/storage/v1/object/public/kyc-documents/abc.jpg",
  key: "abc/123/abc.jpg",
};

describe("createKycSubmissionSchema", () => {
  it("accepts a valid id-card photo + selfie pair", () => {
    expect(
      createKycSubmissionSchema.safeParse({
        idCardPhoto: validPhoto,
        selfie: validPhoto,
      }).success
    ).toBe(true);
  });

  it("rejects a missing selfie", () => {
    expect(
      createKycSubmissionSchema.safeParse({ idCardPhoto: validPhoto }).success
    ).toBe(false);
  });

  it("rejects an id-card photo missing the key (only url supplied)", () => {
    expect(
      createKycSubmissionSchema.safeParse({
        idCardPhoto: { url: validPhoto.url },
        selfie: validPhoto,
      }).success
    ).toBe(false);
  });

  it("rejects an id-card photo with a non-URL url", () => {
    expect(
      createKycSubmissionSchema.safeParse({
        idCardPhoto: { url: "not-a-url", key: "k" },
        selfie: validPhoto,
      }).success
    ).toBe(false);
  });

  it("rejects an empty key", () => {
    expect(
      createKycSubmissionSchema.safeParse({
        idCardPhoto: { url: validPhoto.url, key: "   " },
        selfie: validPhoto,
      }).success
    ).toBe(false);
  });

  it("rejects an unknown top-level field (strict)", () => {
    expect(
      createKycSubmissionSchema.safeParse({
        idCardPhoto: validPhoto,
        selfie: validPhoto,
        note: "please",
      }).success
    ).toBe(false);
  });
});

describe("rejectKycSubmissionSchema", () => {
  it("accepts a non-empty rejection reason", () => {
    expect(
      rejectKycSubmissionSchema.safeParse({
        rejectionReason: "รูปบัตรไม่ชัด กรุณาถ่ายใหม่",
      }).success
    ).toBe(true);
  });

  it("rejects a missing reason", () => {
    expect(rejectKycSubmissionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty/whitespace reason", () => {
    expect(
      rejectKycSubmissionSchema.safeParse({ rejectionReason: "   " }).success
    ).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(
      rejectKycSubmissionSchema.safeParse({
        rejectionReason: "x",
        extra: 1,
      }).success
    ).toBe(false);
  });
});

describe("kycSubmissionSchema (API read shape)", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: "660e8400-e29b-41d4-a716-446655440000",
    idCardPhotoUrl: "https://example.test/kyc/id.jpg",
    idCardPhotoKey: "u1/id.jpg",
    selfieUrl: "https://example.test/kyc/selfie.jpg",
    selfieKey: "u1/selfie.jpg",
    status: KycSubmissionStatus.Pending,
    rejectionReason: null,
    reviewedBy: null,
    submittedAt: "2026-07-07T00:00:00.000Z",
    reviewedAt: null,
  };

  it("accepts a well-shaped pending submission", () => {
    expect(kycSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an approved submission with a reviewer", () => {
    expect(
      kycSubmissionSchema.safeParse({
        ...valid,
        status: KycSubmissionStatus.Approved,
        reviewedBy: "770e8400-e29b-41d4-a716-446655440000",
        reviewedAt: "2026-07-07T01:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("accepts a rejected submission with a reason", () => {
    expect(
      kycSubmissionSchema.safeParse({
        ...valid,
        status: KycSubmissionStatus.Rejected,
        rejectionReason: "ไม่ตรงเงื่อนไข",
        reviewedBy: "770e8400-e29b-41d4-a716-446655440000",
        reviewedAt: "2026-07-07T01:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects an unknown status value", () => {
    expect(kycSubmissionSchema.safeParse({ ...valid, status: "None" }).success).toBe(false);
  });

  it("rejects a non-UUID id", () => {
    expect(kycSubmissionSchema.safeParse({ ...valid, id: "nope" }).success).toBe(false);
  });
});

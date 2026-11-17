import { describe, expect, it } from "vitest";
import { can, type Capability } from "@/lib/access";
import type { AccessRole } from "@/db/schema";

/** The full permission matrix from the HLD. If this changes, it should be on purpose. */
const EXPECTED: Record<AccessRole | "none", Record<Capability, boolean>> = {
  owner: { read: true, edit: true, rename: true, share: true, delete: true },
  editor: { read: true, edit: true, rename: true, share: false, delete: false },
  viewer: { read: true, edit: false, rename: false, share: false, delete: false },
  none: { read: false, edit: false, rename: false, share: false, delete: false },
};

describe("access matrix: can(role, capability)", () => {
  for (const [role, caps] of Object.entries(EXPECTED)) {
    for (const [cap, allowed] of Object.entries(caps)) {
      it(`${role} ${allowed ? "CAN" : "cannot"} ${cap}`, () => {
        const r = role === "none" ? null : (role as AccessRole);
        expect(can(r, cap as Capability)).toBe(allowed);
      });
    }
  }
});

import { test, expect } from "../../src/fixtures/api.fixtures.js";
import { buildPet } from "../../src/helpers/data.builders.js";
import { petSchema } from "../../src/api/petstore.schemas.js";
import { expectJsonMatchesSchema } from "../../src/helpers/assert.js";
import { API_PREFIX } from "../../src/api/constants.js";

test.describe("POST /pet/{petId} update with form data", () => {
  test("TC-01 @smoke updates only name", async ({ petstore, apiStep }) => {
    const pet = buildPet({ name: "OldName", status: "available" });
    await petstore.createPet(pet);

    await apiStep("Update name via form", async () => {
      const upd = await petstore.updatePetWithForm(pet.id, { name: "NewName" });
      expect([200, 204]).toContain(upd.status());
    });

    const g = await petstore.getPet(pet.id);
    expect(g.status()).toBe(200);
    const json = await g.json();

    await apiStep("Validate response schema + updated field", async () => {
      expectJsonMatchesSchema(petSchema, json);
      expect(json.id).toBe(pet.id);
      expect(json.name).toBe("NewName");
      expect(json.status).toBe("available");
    });
  });

  test("TC-02 @smoke updates only status", async ({ petstore, apiStep }) => {
    const pet = buildPet({ name: "Dog", status: "available" });
    await petstore.createPet(pet);

    await apiStep("Update status via form", async () => {
      const upd = await petstore.updatePetWithForm(pet.id, { status: "sold" });
      expect([200, 204]).toContain(upd.status());
    });

    const g = await petstore.getPet(pet.id);
    expect(g.status()).toBe(200);
    const json = await g.json();

    await apiStep("Validate schema + status change", async () => {
      expectJsonMatchesSchema(petSchema, json);
      expect(json.id).toBe(pet.id);
      expect(json.name).toBe("Dog");
      expect(json.status).toBe("sold");
    });
  });

  test("TC-03 @regression updates name and status", async ({ petstore, apiStep }) => {
    const pet = buildPet({ name: "Dog", status: "pending" });
    await petstore.createPet(pet);

    await apiStep("Update name and status via form", async () => {
      const upd = await petstore.updatePetWithForm(pet.id, { name: "SuperDog", status: "available" });
      expect([200, 204]).toContain(upd.status());
    });

    const g = await petstore.getPet(pet.id);
    expect(g.status()).toBe(200);
    const json = await g.json();

    await apiStep("Validate schema + both fields updated", async () => {
      expectJsonMatchesSchema(petSchema, json);
      expect(json.id).toBe(pet.id);
      expect(json.name).toBe("SuperDog");
      expect(json.status).toBe("available");
    });
  });

  test("TC-04 @regression repeat same update keeps stable state", async ({ petstore, apiStep }) => {
    const pet = buildPet({ name: "Dog", status: "available" });
    await petstore.createPet(pet);

    await apiStep("Apply update #1", async () => {
      const u1 = await petstore.updatePetWithForm(pet.id, { name: "Same", status: "sold" });
      expect([200, 204]).toContain(u1.status());
    });

    await apiStep("Apply update #2 (same payload)", async () => {
      const u2 = await petstore.updatePetWithForm(pet.id, { name: "Same", status: "sold" });
      expect([200, 204]).toContain(u2.status());
    });

    const g = await petstore.getPet(pet.id);
    expect(g.status()).toBe(200);
    const json = await g.json();

    await apiStep("Validate final state", async () => {
      expectJsonMatchesSchema(petSchema, json);
      expect(json.name).toBe("Same");
      expect(json.status).toBe("sold");

      const normalized = String(json.status).toLowerCase();
      expect(["available", "pending", "sold"]).toContain(normalized);
    });
  });

  test("TC-05 @regression name with spaces & спецсимволы", async ({ petstore, apiStep }) => {
    const pet = buildPet({ name: "Dog", status: "available" });
    await petstore.createPet(pet);

    const newName = "Mr Dog & Co";

    await apiStep("Update name with special chars", async () => {
      const upd = await petstore.updatePetWithForm(pet.id, { name: newName });
      expect([200, 204]).toContain(upd.status());
    });

    const g = await petstore.getPet(pet.id);
    expect(g.status()).toBe(200);
    const json = await g.json();

    await apiStep("Validate name stored correctly", async () => {
      expectJsonMatchesSchema(petSchema, json);
      expect(json.name).toBe(newName);
    });
  });

  test("TC-06 @regression negative: non-existent petId", async ({ petstore, apiStep }) => {
    const missingId = 999999999999;

    await apiStep("Try update non-existent pet", async () => {
      const upd = await petstore.updatePetWithForm(missingId, { name: "NoOne" });
      expect([400, 404, 405]).toContain(upd.status());
    });
  });

  test("TC-07 @regression negative: invalid status value", async ({ petstore, apiStep }) => {
    const pet = buildPet({ name: "Dog", status: "available" });
    await petstore.createPet(pet);

    await apiStep("Update status with invalid value", async () => {
      const upd = await petstore.updatePetWithForm(pet.id, { status: "UNKNOWN_STATUS" });
      expect([200, 204, 400, 405]).toContain(upd.status());
    });
  });

  test("TC-08 @regression negative: empty form (no name/status)", async ({ petstore, apiStep }) => {
    const pet = buildPet({ name: "Dog", status: "available" });
    await petstore.createPet(pet);

    await apiStep("Send empty form", async () => {
      const upd = await petstore.updatePetWithForm(pet.id, {});
      expect([200, 204, 400, 405]).toContain(upd.status());
    });
  });

  test("TC-09 @regression negative: wrong content-type (json instead of form)", async ({ request, petstore, apiStep }) => {
    const pet = buildPet({ name: "Dog", status: "available" });
    await petstore.createPet(pet);

    await apiStep("Send JSON payload to form endpoint", async () => {
     const res = await request.post(`${API_PREFIX}/pet/${pet.id}`, {
     data: { name: "JsonName" }
    });
      expect([200, 204, 400, 405, 415]).toContain(res.status());
    });
  });
});

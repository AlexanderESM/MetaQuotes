import Ajv from "ajv";
import addFormats from "ajv-formats";
import { expect } from "@playwright/test";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export function expectJsonMatchesSchema(schema: object, json: unknown) {
  const validate = ajv.compile(schema);
  const ok = validate(json);
  if (!ok) {
    const msg = ajv.errorsText(validate.errors, { separator: "\n" });
    expect(ok, msg).toBeTruthy();
  }
}

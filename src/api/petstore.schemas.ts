export const petSchema = {
  type: "object",
  required: ["id", "name", "photoUrls"],
  properties: {
    id: { type: "number" },
    name: { type: "string" },
    status: { type: "string" },
    photoUrls: {
      type: "array",
      items: { type: "string" },
      minItems: 1
    }
  },
  additionalProperties: true
} as const;

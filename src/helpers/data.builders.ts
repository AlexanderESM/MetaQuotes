export type PetStatus = "available" | "pending" | "sold";

export type Pet = {
  id: number;
  name: string;
  status?: PetStatus | string;
  photoUrls: string[];
};

export function uniquePetId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

export function buildPet(params?: Partial<Pet>): Pet {
  return {
    id: params?.id ?? uniquePetId(),
    name: params?.name ?? "doggie",
    status: params?.status ?? "available",
    photoUrls: params?.photoUrls ?? ["https://example.com/photo.png"]
  };
}

export interface SheetResponse {
  id: number;
  name: string;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
}

export interface SheetUpsertRequest {
  name: string;
  categoryId: number;
}
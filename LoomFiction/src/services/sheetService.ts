import type { SheetResponse } from '../types/sheet';


function unavailable<R>(): Promise<R> {
  return Promise.reject(new Error('API des fiches non disponible.'));
}

export const sheetService = {
  getAll: () => unavailable<SheetResponse[]>(),
  create: () => unavailable<SheetResponse>(),
  update: () => unavailable<SheetResponse>(),
  delete: () => unavailable<void>(),
};
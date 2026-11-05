import { useState, useEffect } from 'react';
import { offlineCategoryService } from '../../../services/offlineCategoryService'; 
import type { CategoryResponse, CategoryUpsertRequest } from '../../../types/category';

const DEFAULT_ERROR = "Erreur lors du chargement des catégories.";

const messageOf = (err: unknown): string =>
  (err as { message?: string } | null)?.message || DEFAULT_ERROR;

export function useCategories() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const data = await offlineCategoryService.getAll();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    offlineCategoryService
      .getAll()
      .then((data) => {
        if (cancelled) return;
        setCategories(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const createCategory = async (data: CategoryUpsertRequest) => {
    const updated = await offlineCategoryService.create(data);
    setCategories(updated);
    return updated;
  };

  const updateCategory = async (id: number, data: CategoryUpsertRequest) => {
    const updated = await offlineCategoryService.update(id, data);
    setCategories(updated);
    return updated;
  };

  const deleteCategory = async (id: number) => {
    const updated = await offlineCategoryService.remove(id);
    setCategories(updated);
    return updated;
  };

  return {
    categories,
    setCategories,
    isLoading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    refreshCategories: fetchCategories,
  };
}
import { apiRequest } from './client';
import type { CategoryItem } from './types';

export const categoriesApi = {
  async listCategories(): Promise<{ items: CategoryItem[] }> {
    const raw = await apiRequest<{ categories?: CategoryItem[]; items?: CategoryItem[] }>('categories', {
      method: 'GET',
    });
    return { items: raw?.categories ?? raw?.items ?? [] };
  },

  async createCategory(payload: { name: string; description?: string }): Promise<{ category: CategoryItem }> {
    return apiRequest<{ category: CategoryItem }>('categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCategory(id: string, payload: { name?: string; description?: string; active?: boolean }): Promise<{ category: CategoryItem }> {
    return apiRequest<{ category: CategoryItem }>(`categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

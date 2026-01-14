import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export const useAliases = () => {
  return useQuery({
    queryKey: ['aliases'],
    queryFn: async () => {
      const { data } = await apiClient.get('/aliases');
      return data;
    },
  });
};

export const usePhotos = (alias) => {
  return useInfiniteQuery({
    queryKey: ['photos', alias],
    queryFn: async ({ pageParam = '' }) => {
      if (!alias) return { photos: [], next_cursor: '' };
      const { data } = await apiClient.get('/photos', {
        params: {
          alias: alias,
          cursor: pageParam,
          limit: 50,
        },
      });
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    enabled: !!alias,
  });
};

export const useDeletePhoto = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ alias, path }) => {
            await apiClient.delete('/photo', {
                params: { alias, path }
            });
        },
        onSuccess: (_, variables) => {
            // Invalidate photos query for the specific alias
            queryClient.invalidateQueries({ queryKey: ['photos', variables.alias] });
        }
    });
};

export const useUploadPhoto = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ alias, formData }) => {
            await apiClient.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { alias } // Some implementations might need this or just formData
            });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['photos', variables.alias] });
        }
    });
};

export const useAddAlias = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (alias) => {
            await apiClient.post('/alias', alias);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['aliases'] });
        }
    });
};

export const useUpdateAlias = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ oldName, newName }) => {
            await apiClient.put('/alias', { old_name: oldName, new_name: newName });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['aliases'] });
        }
    });
};

export const useDeleteAlias = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (name) => {
            await apiClient.delete('/alias', { params: { name } });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['aliases'] });
        }
    });
};

export const useClearCache = () => {
    return useMutation({
        mutationFn: async () => {
            await apiClient.post('/cache/clear');
        }
    });
};

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

// Support full alias editing (not just name)
export const useUpdateAlias = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (updateData) => {
            // updateData: { oldName, newName, path?, bucket?, endpoint?, region?, access_key?, secret_key? }
            await apiClient.put('/alias', {
                old_name: updateData.oldName,
                new_name: updateData.newName,
                path: updateData.path,
                bucket: updateData.bucket,
                endpoint: updateData.endpoint,
                region: updateData.region,
                access_key: updateData.access_key,
                secret_key: updateData.secret_key,
            });
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

// Test S3 connection without saving
export const useTestS3Connection = () => {
    return useMutation({
        mutationFn: async (config) => {
            const { data } = await apiClient.post('/s3/test', {
                endpoint: config.endpoint,
                bucket: config.bucket,
                access_key: config.access_key,
                secret_key: config.secret_key,
                region: config.region,
            });
            return data;
        }
    });
};

export const useMovePhotos = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ alias, paths, destAlias, destPath }) => {
            const { data } = await apiClient.post('/photos/move', {
                alias,
                paths,
                dest_alias: destAlias,
                dest_path: destPath
            });
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['photos', variables.alias] });
            if (variables.alias !== variables.destAlias) {
                queryClient.invalidateQueries({ queryKey: ['photos', variables.destAlias] });
            }
        }
    });
};

import axios from 'axios';
import type { Task, TaskCreatePayLoad, TaskUpdatePayLoad } from './task.type';

const BASE_URL = 'http://localhost:8000/api';

const apiClient = axios.create({
   baseURL: BASE_URL,
   headers: { 'Content-Type': 'application/json' },
});

export const taskApi = {
   getAllTasks: async (): Promise<Task[]> => {
      const response = await apiClient.get<Task[]>('/tasks');
      return response.data;
   },

   createTask: async (payload: TaskCreatePayLoad): Promise<Task> => {
      const response = await apiClient.post<Task>('/tasks', payload);
      return response.data;
   },

   updateTask: async (
      id: number,
      payload: TaskUpdatePayLoad
   ): Promise<Task> => {
      const response = await apiClient.patch<Task>(`/tasks/${id}`, payload);
      return response.data;
   },

   deleteTask: async (id: number): Promise<void> => {
      await apiClient.delete(`/tasks/${id}`);
   },
};

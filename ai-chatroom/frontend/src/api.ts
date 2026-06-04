import type { Message, Session } from './types';
import axios from 'axios';

const apiClient = axios.create({
   baseURL: '/api/sessions',
   headers: {
      'Content-Type': 'application/json',
   },
});

export const api = {
   async getSessions(): Promise<{ sessions: Session[] }> {
      const res = await apiClient.get<{ sessions: Session[] }>('');
      return res.data;
   },

   async createSession(): Promise<Session> {
      const res = await apiClient.post<Session>('');
      return res.data;
   },

   async deleteSession(session_id: string): Promise<void> {
      await apiClient.delete(`/${session_id}`);
   },

   async getMessages(session_id: string): Promise<Message[]> {
      const res = await apiClient.get<Message[]>(`/${session_id}/messages`);
      return res.data;
   },

   async chat(session_id: string, content: string): Promise<Message> {
      const res = await apiClient.post<Message>(`/${session_id}/chat`, {
         content,
      });
      return res.data;
   },

   async clearContext(session_id: string): Promise<void> {
      await apiClient.post(`/${session_id}/clear`);
   },
};

export interface Message {
   role: 'user' | 'assistant';
   content: string;
}

export interface Session {
   session_id: string;
   title: string;
}

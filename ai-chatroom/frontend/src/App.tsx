import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Eraser, Send, MessageSquare } from 'lucide-react';
import { api } from './api';
import type { Session, Message } from './types';
import { ChatBubble } from './components/ChatBubble';

export default function App() {
   const [sessions, setSessions] = useState<Session[]>([]);
   const [currentSid, setCurrentSid] = useState<string | null>(null);
   const [messages, setMessages] = useState<Message[]>([]);
   const [input, setInput] = useState('');
   const [loading, setLoading] = useState(false);
   const scrollRef = useRef<HTMLDivElement>(null);

   // 初始化：获取会话列表
   useEffect(() => {
      refreshSessions();
   }, []);

   // 切换会话：加载消息历史
   useEffect(() => {
      if (currentSid) {
         api.getMessages(currentSid).then(setMessages);
      } else {
         setMessages([]);
      }
   }, [currentSid]);

   // 自动滚动到底部
   useEffect(() => {
      scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
   }, [messages]);

   const refreshSessions = async () => {
      const data = await api.getSessions();
      setSessions(data.sessions);
   };

   const handleCreateSession = async () => {
      const newSession = await api.createSession();
      await refreshSessions();
      setCurrentSid(newSession.session_id);
   };

   const handleSend = async () => {
      if (!input.trim() || !currentSid || loading) return;

      const userMsg: Message = { role: 'user', content: input };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
         const aiMsg = await api.chat(currentSid, input);
         setMessages((prev) => [...prev, aiMsg]);
         // 发送完第一条消息后，标题会更新，刷新左侧列表
         if (messages.length === 0) refreshSessions();
      } catch (err) {
         setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'AI 思想开小差了...' },
         ]);
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className='flex h-screen bg-white text-gray-900 font-sans'>
         {/* Step 2: Sidebar (Ollama 风格) */}
         <aside className='w-64 border-r border-gray-100 flex flex-col bg-[#f9fafb]'>
            <div className='p-4'>
               <button
                  onClick={handleCreateSession}
                  className='w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-white transition-all text-sm font-medium shadow-sm'
               >
                  <Plus size={16} /> New Topic
               </button>
            </div>

            <nav className='flex-1 overflow-y-auto px-2 space-y-1'>
               {sessions.map((s) => (
                  <div
                     key={s.session_id}
                     onClick={() => setCurrentSid(s.session_id)}
                     className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                        currentSid === s.session_id
                           ? 'bg-white shadow-sm ring-1 ring-gray-200'
                           : 'hover:bg-gray-200/50'
                     }`}
                  >
                     <div className='flex items-center gap-2 truncate'>
                        <MessageSquare size={14} className='opacity-40' />
                        <span className='truncate'>{s.title}</span>
                     </div>
                     <Trash2
                        size={14}
                        className='opacity-0 group-hover:opacity-40 hover:opacity-100! text-red-600 transition-opacity'
                        onClick={(e) => {
                           e.stopPropagation();
                           api.deleteSession(s.session_id).then(
                              refreshSessions
                           );
                        }}
                     />
                  </div>
               ))}
            </nav>
         </aside>

         {/* Step 3: Main Chat Window */}
         <main className='flex-1 flex flex-col min-w-0 bg-white'>
            {/* Header */}
            <header className='h-14 border-b border-gray-50 flex items-center justify-between px-8'>
               <h2 className='text-sm font-medium text-gray-500'>
                  {currentSid
                     ? `Session: ${currentSid.slice(0, 8)}...`
                     : 'Select a session'}
               </h2>
               {currentSid && (
                  <button
                     onClick={() =>
                        api.clearContext(currentSid).then(() => setMessages([]))
                     }
                     className='flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors'
                  >
                     <Eraser size={14} /> Clear Context
                  </button>
               )}
            </header>

            {/* Messages */}
            <div ref={scrollRef} className='flex-1 overflow-y-auto px-8 py-4'>
               <div className='max-w-3xl mx-auto'>
                  {messages.length === 0 && !loading && (
                     <div className='h-full flex items-center justify-center text-gray-300 mt-20 flex-col gap-4'>
                        <div className='w-12 h-12 rounded-full border-2 border-gray-100 flex items-center justify-center'>
                           <MessageSquare size={24} />
                        </div>
                        <p className='text-sm italic'>
                           Start a conversation with DeepSeek V4
                        </p>
                     </div>
                  )}
                  {messages.map((m, i) => (
                     <ChatBubble key={i} message={m} />
                  ))}
                  {loading && (
                     <div className='flex justify-start my-4'>
                        <div className='bg-gray-100 px-4 py-3 rounded-2xl animate-pulse text-xs text-gray-400'>
                           DeepSeek is thinking...
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* Input Area */}
            <div className='p-8 bg-linear-to-t from-white via-white to-transparent'>
               <div className='max-w-3xl mx-auto relative'>
                  <textarea
                     rows={1}
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        (e.preventDefault(), handleSend())
                     }
                     placeholder='Send a message...'
                     className='w-full p-4 pr-12 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black resize-none shadow-sm text-sm'
                  />
                  <button
                     onClick={handleSend}
                     disabled={!currentSid || loading}
                     className='absolute right-3 bottom-3 p-1.5 bg-black text-white rounded-lg hover:opacity-80 disabled:opacity-20 transition-all'
                  >
                     <Send size={18} />
                  </button>
               </div>
               <p className='text-[10px] text-center mt-3 text-gray-400 uppercase tracking-widest'>
                  Powered by FastAPI + Redis + DeepSeek
               </p>
            </div>
         </main>
      </div>
   );
}

import React, { useState } from 'react';
import { apiClient } from '../services/api';

interface CitationSource {
   file_name: string;
   content: string;
   score: number;
}

interface ChatMessage {
   id: string;
   role: 'user' | 'assistant';
   content: string;
   routingMode?: 'rag' | 'general';
   citations?: CitationSource[];
}

export const KnowledgeChatWorkbench: React.FC = () => {
   const [inputVal, setInputVal] = useState('');
   const [messages, setMessages] = useState<ChatMessage[]>([]);
   const [isAiStreaming, setIsAiStreaming] = useState(false);
   const [activeCitationIdx, setActiveCitationIdx] = useState<string | null>(
      null
   );

   const triggerPipelineQA = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputVal.trim() || isAiStreaming) return;

      const userMessage: ChatMessage = {
         id: crypto.randomUUID(),
         role: 'user',
         content: inputVal,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputVal('');
      setIsAiStreaming(true);

      try {
         const response = await apiClient.post('/qa/query', {
            question: userMessage.content,
         });
         const apiResult = response.data;

         if (apiResult.code === 200 && apiResult.data) {
            const aiMessage: ChatMessage = {
               id: crypto.randomUUID(),
               role: 'assistant',
               content: apiResult.data.answer,
               routingMode: apiResult.data.routing_mode,
               citations: apiResult.data.citations,
            };
            setMessages((prev) => [...prev, aiMessage]);
         }
      } catch (err) {
         setMessages((prev) => [
            ...prev,
            {
               id: crypto.randomUUID(),
               role: 'assistant',
               content: `⚠️ 【网关熔断】 无法连接到大模型向量引擎，Axios 触发熔断保护。`,
            },
         ]);
      } finally {
         setIsAiStreaming(false);
      }
   };

   return (
      <div className='w-full max-w-4xl mx-auto flex flex-col h-[650px] border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm'>
         {/* 消息画布流 */}
         <div className='flex-1 overflow-y-auto p-6 space-y-6'>
            {messages.map((msg) => (
               <div key={msg.id} className='space-y-3'>
                  <div
                     className={`flex ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                     }`}
                  >
                     <div
                        className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm border ${
                           msg.role === 'user'
                              ? 'bg-slate-900 border-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                     >
                        {msg.routingMode === 'general' && (
                           <div className='mb-2 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded border border-amber-200/40'>
                              💡 当前未命中物理知识库，已降级为通用模式解答
                           </div>
                        )}
                        <p className='leading-relaxed whitespace-pre-wrap'>
                           {msg.content}
                        </p>
                     </div>
                  </div>

                  {/* 可审计引用溯源卡片组件 (Citations Bubble Matrix) */}
                  {msg.role === 'assistant' &&
                     msg.citations &&
                     msg.citations.length > 0 && (
                        <div className='pl-2 flex flex-col space-y-2'>
                           <div className='flex items-center space-x-1 text-xs text-slate-400 font-medium'>
                              <svg
                                 className='w-3.5 h-3.5 text-emerald-500'
                                 fill='none'
                                 stroke='currentColor'
                                 viewBox='0 0 24 24'
                              >
                                 <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
                                 />
                              </svg>
                              <span>
                                 知识库审计溯源凭证 ({msg.citations.length}{' '}
                                 个参考基点) :
                              </span>
                           </div>

                           <div className='flex flex-wrap gap-2'>
                              {msg.citations.map((cite, index) => {
                                 const uniqueTileId = `${msg.id}-${index}`;
                                 const isExpanded =
                                    activeCitationIdx === uniqueTileId;

                                 return (
                                    <div
                                       key={index}
                                       className='w-full max-w-md'
                                    >
                                       <button
                                          type='button'
                                          onClick={() =>
                                             setActiveCitationIdx(
                                                isExpanded ? null : uniqueTileId
                                             )
                                          }
                                          className={`w-full flex items-center justify-between text-left px-3 py-1.5 rounded-xl border text-xs transition-all ${
                                             isExpanded
                                                ? 'bg-slate-50 border-slate-400 dark:bg-slate-900'
                                                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 dark:bg-slate-900/40 dark:border-slate-800'
                                          }`}
                                       >
                                          <span className='font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[240px]'>
                                             📄 [{index + 1}] {cite.file_name}
                                          </span>
                                          <span className='font-mono text-[10px] bg-emerald-100/60 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.2 rounded'>
                                             匹配度:{' '}
                                             {(cite.score * 100).toFixed(1)}%
                                          </span>
                                       </button>

                                       {/* 抽屉式具体切片原文穿透展示 */}
                                       {isExpanded && (
                                          <div className='mt-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-normal font-sans animate-fadeIn'>
                                             <div className='font-semibold text-[10px] uppercase text-slate-400 mb-1'>
                                                物理切片原文:
                                             </div>
                                             {cite.content}
                                          </div>
                                       )}
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     )}
               </div>
            ))}
         </div>

         {/* 控制台发送栏 */}
         <form
            onSubmit={triggerPipelineQA}
            className='p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
         >
            <div className='flex gap-3'>
               <input
                  type='text'
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  disabled={isAiStreaming}
                  placeholder='向本地企业知识库提出高精度的业务问题...'
                  className='flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500'
               />
               <button
                  type='submit'
                  disabled={isAiStreaming || !inputVal.trim()}
                  className='px-5 bg-slate-950 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium rounded-xl transition-all'
               >
                  发送
               </button>
            </div>
         </form>
      </div>
   );
};

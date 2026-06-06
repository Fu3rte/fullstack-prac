import React, { useState, type SyntheticEvent } from 'react';
import { apiClient } from '../services/api';

interface ChunkSearchResult {
   chunk_id: string;
   file_name: string;
   content: string;
   similarity: number;
}

export const VectorPlayground: React.FC = () => {
   const [searchQuery, setSearchQuery] = useState('');
   const [topK, setTopK] = useState(3);
   const [isLoading, setIsLoading] = useState(false);
   const [results, setResults] = useState<ChunkSearchResult[]>([]);
   const [errorBanner, setErrorBanner] = useState<string | null>(null);

   const triggerVectorSearch = async (e: SyntheticEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;

      setIsLoading(true);
      setErrorBanner(null);

      try {
         const res = await apiClient.post('/search', {
            text: searchQuery,
            top_k: topK,
         });

         const jsonRes = res.data;
         if (jsonRes.code === 200 && jsonRes.data) {
            setResults(jsonRes.data.results);
         } else {
            throw new Error(
               jsonRes.message || 'Unknown error inside pipeline.'
            );
         }
      } catch (err) {
         setErrorBanner(
            err instanceof Error ? err.message : 'Network anomalous event.'
         );
         setResults([]);
      } finally {
         setIsLoading(false);
      }
   };

   // 根据相似度置信度动态输出 Tailwind 配色色阶
   const computeScoreBadgeColor = (score: number) => {
      if (score >= 0.7)
         return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800';
      if (score >= 0.5)
         return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800';
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800';
   };

   return (
      <div className='w-full max-w-4xl mx-auto p-6 space-y-6'>
         {/* 搜索控制台 */}
         <form
            onSubmit={triggerVectorSearch}
            className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4'
         >
            <div className='flex flex-col md:flex-row md:items-center gap-4'>
               <div className='flex-1 relative'>
                  <input
                     type='text'
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder='输入查询文本，测试 pgvector 相似度匹配效率...'
                     className='w-full pl-4 pr-12 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                  />
                  {isLoading && (
                     <div className='absolute right-4 top-3.5 animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent' />
                  )}
               </div>

               <div className='flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700'>
                  <label className='text-xs font-medium text-slate-500 whitespace-nowrap'>
                     召回样本数 Top-K: {topK}
                  </label>
                  <input
                     type='range'
                     min='1'
                     max='10'
                     value={topK}
                     onChange={(e) => setTopK(Number(e.target.value))}
                     className='w-24 accent-emerald-500 cursor-pointer'
                  />
               </div>

               <button
                  type='submit'
                  disabled={isLoading || !searchQuery.trim()}
                  className='px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none'
               >
                  高并发检索
               </button>
            </div>
         </form>

         {/* 错误展示边界 */}
         {errorBanner && (
            <div className='p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl'>
               {errorBanner}
            </div>
         )}

         {/* 召回切片结果流 */}
         <div className='space-y-4'>
            {results.length > 0
               ? results.map((chunk) => (
                    <div
                       key={chunk.chunk_id}
                       className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col space-y-3'
                    >
                       <div className='flex items-center justify-between'>
                          <div className='flex items-center space-x-2'>
                             <svg
                                className='w-4 h-4 text-slate-400'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                             >
                                <path
                                   strokeLinecap='round'
                                   strokeLinejoin='round'
                                   strokeWidth={2}
                                   d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h5a2 2 0 012 2v7'
                                />
                             </svg>
                             <span className='text-xs font-semibold text-slate-600 dark:text-slate-300 truncate max-w-xs'>
                                {chunk.file_name}
                             </span>
                             <span className='text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono'>
                                ID: {chunk.chunk_id}
                             </span>
                          </div>

                          <div
                             className={`px-2 py-0.5 rounded-full border text-xs font-mono font-bold shadow-2xs ${computeScoreBadgeColor(
                                chunk.similarity
                             )}`}
                          >
                             Score: {chunk.similarity}
                          </div>
                       </div>

                       <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 font-sans'>
                          {chunk.content}
                       </p>
                    </div>
                 ))
               : !isLoading && (
                    <div className='text-center py-12 text-slate-400 text-xs'>
                       暂无匹配样本，请在上方输入关键词检索 pgvector 存储集群
                    </div>
                 )}
         </div>
      </div>
   );
};

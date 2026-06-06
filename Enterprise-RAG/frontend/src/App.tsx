import { useState, useCallback } from 'react';
import { KnowledgeChatWorkbench } from './components/KnowledgeChatWorkbench';
import { VectorPlayground } from './components/VectorPlayground';
import { FileDropZone } from './components/FileDropZone';

interface TaskInfo {
   taskId: string;
   fileName: string;
   status: 'processing' | 'completed' | 'failed';
   message: string;
}

function App() {
   const [tasks, setTasks] = useState<TaskInfo[]>([]);
   const [notification, setNotification] = useState<{
      type: 'success' | 'error';
      message: string;
   } | null>(null);

   const showNotification = useCallback(
      (type: 'success' | 'error', message: string) => {
         setNotification({ type, message });
         setTimeout(() => setNotification(null), 4000);
      },
      []
   );

   const handleUploadAccepted = useCallback(
      (taskId: string, fileName: string) => {
         setTasks((prev) => [
            ...prev,
            { taskId, fileName, status: 'processing', message: '处理中...' },
         ]);
         showNotification('success', `文件 ${fileName} 已加入处理队列`);

         // 轮询任务状态
         const interval = setInterval(async () => {
            try {
               const res = await fetch(
                  `http://localhost:8000/api/documents/tasks/${taskId}`
               );
               const data = await res.json();
               if (data.code === 200 && data.data) {
                  const taskStatus = data.data.status;
                  setTasks((prev) =>
                     prev.map((t) =>
                        t.taskId === taskId
                           ? {
                                ...t,
                                status: taskStatus,
                                message:
                                   taskStatus === 'completed'
                                      ? `已完成，共 ${data.data.total_chunks} 个切片`
                                      : data.data.message || t.message,
                             }
                           : t
                     )
                  );
                  if (taskStatus === 'completed' || taskStatus === 'failed') {
                     clearInterval(interval);
                     if (taskStatus === 'completed') {
                        showNotification(
                           'success',
                           `文件 ${fileName} 处理完成`
                        );
                     } else {
                        showNotification(
                           'error',
                           `文件 ${fileName} 处理失败: ${data.data.message}`
                        );
                     }
                  }
               }
            } catch {
               clearInterval(interval);
            }
         }, 2000);
      },
      [showNotification]
   );

   const handleUploadError = useCallback(
      (errorMessage: string) => {
         showNotification('error', errorMessage);
      },
      [showNotification]
   );

   return (
      <div className='min-h-screen bg-slate-100 dark:bg-slate-950'>
         {/* 通知浮层 */}
         {notification && (
            <div
               className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all animate-fadeIn ${
                  notification.type === 'success'
                     ? 'bg-emerald-600 text-white'
                     : 'bg-rose-600 text-white'
               }`}
            >
               {notification.type === 'success' ? '✅ ' : '❌ '}
               {notification.message}
            </div>
         )}

         {/* 顶部导航 */}
         <header className='bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40'>
            <div className='max-w-7xl mx-auto px-6 py-4 flex items-center justify-between'>
               <div className='flex items-center space-x-3'>
                  <div className='w-8 h-8 bg-slate-900 dark:bg-emerald-600 rounded-lg flex items-center justify-center'>
                     <svg
                        className='w-5 h-5 text-white'
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
                  </div>
                  <h1 className='text-lg font-bold text-slate-900 dark:text-slate-100'>
                     Enterprise RAG 知识库平台
                  </h1>
               </div>

               {/* 任务状态指示 */}
               {tasks.length > 0 && (
                  <div className='flex items-center space-x-2 text-xs text-slate-500'>
                     <span>任务:</span>
                     {tasks.filter((t) => t.status === 'processing').length >
                        0 && (
                        <span className='flex items-center space-x-1'>
                           <span className='h-2 w-2 bg-amber-500 rounded-full animate-pulse' />
                           <span>
                              {
                                 tasks.filter((t) => t.status === 'processing')
                                    .length
                              }{' '}
                              处理中
                           </span>
                        </span>
                     )}
                     <span className='text-emerald-600'>
                        {tasks.filter((t) => t.status === 'completed').length}{' '}
                        完成
                     </span>
                  </div>
               )}
            </div>
         </header>

         {/* 主体内容 */}
         <main className='max-w-7xl mx-auto p-6'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
               {/* 左侧：上传 + 搜索 */}
               <div className='space-y-6'>
                  {/* 上传区域 */}
                  <section className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden'>
                     <div className='px-6 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800'>
                        <h2 className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                           📤 文档上传
                        </h2>
                     </div>
                     <FileDropZone
                        onUploadAccepted={handleUploadAccepted}
                        onUploadError={handleUploadError}
                     />

                     {/* 任务列表 */}
                     {tasks.length > 0 && (
                        <div className='px-6 pb-4 space-y-1.5'>
                           {tasks.map((task) => (
                              <div
                                 key={task.taskId}
                                 className='flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800'
                              >
                                 <span className='truncate max-w-[200px] text-slate-600 dark:text-slate-400'>
                                    {task.fileName}
                                 </span>
                                 <div className='flex items-center space-x-2'>
                                    {task.status === 'processing' && (
                                       <span className='text-amber-500 animate-pulse'>
                                          处理中...
                                       </span>
                                    )}
                                    {task.status === 'completed' && (
                                       <span className='text-emerald-600'>
                                          ✅ {task.message}
                                       </span>
                                    )}
                                    {task.status === 'failed' && (
                                       <span
                                          className='text-rose-600 cursor-help'
                                          title={task.message}
                                       >
                                          ❌ 失败
                                       </span>
                                    )}
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </section>

                  {/* 向量搜索 */}
                  <section className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden'>
                     <div className='px-6 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800'>
                        <h2 className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                           🔍 向量检索测试
                        </h2>
                     </div>
                     <VectorPlayground />
                  </section>
               </div>

               {/* 右侧：知识库问答 */}
               <div className='lg:row-span-2'>
                  <KnowledgeChatWorkbench />
               </div>
            </div>
         </main>
      </div>
   );
}

export default App;

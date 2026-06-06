import React, { useState, useRef } from 'react';
import { apiClient } from '../services/api';

interface FileDropZoneProps {
   onUploadAccepted: (taskId: string, fileName: string) => void;
   onUploadError: (errorMessage: string) => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
   onUploadAccepted,
   onUploadError,
}) => {
   const [isDragActive, setIsDragActive] = useState(false);
   const [isUploading, setIsUploading] = useState(false);
   const [uploadProgress, setUploadProgress] = useState(0);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const toggleDragState = (e: React.DragEvent, isActive: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(isActive);
   };

   const handleFileProcess = async (file: File) => {
      const legalExtensions = ['txt', 'md', 'pdf'];
      const fileExt = file.name.split('.').pop()?.toLowerCase();

      if (!fileExt || !legalExtensions.includes(fileExt)) {
         onUploadError('仅支持扩展名为 .txt, .md, .pdf 的文件');
         return;
      }

      setIsUploading(true);
      setUploadProgress(20);

      const payload = new FormData();
      payload.append('file', file);

      try {
         setUploadProgress(60);

         const res = await apiClient.post('/documents/upload', payload, {
            headers: { 'Content-Type': 'multipart/form-data' },
         });
         setUploadProgress(100);

         const responseBody = res.data;
         if (responseBody.code === 202 && responseBody.data) {
            onUploadAccepted(
               responseBody.data.task_id,
               responseBody.data.file_name
            );
         } else {
            throw new Error(
               responseBody.message || 'Pipeline initialization failed.'
            );
         }
      } catch (error) {
         onUploadError(
            error instanceof Error ? error.message : 'Network error.'
         );
      } finally {
         setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);
         }, 800);
      }
   };

   return (
      <div className='w-full max-w-2xl mx-auto p-6'>
         <div
            onDragEnter={(e) => toggleDragState(e, true)}
            onDragOver={(e) => toggleDragState(e, true)}
            onDragLeave={(e) => toggleDragState(e, false)}
            onDrop={(e) => {
               toggleDragState(e, false);
               if (e.dataTransfer.files?.[0])
                  handleFileProcess(e.dataTransfer.files[0]);
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ease-in-out ${
               isDragActive
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-900'
            } ${
               isUploading ? 'pointer-events-none opacity-80' : 'cursor-pointer'
            }`}
         >
            <input
               ref={fileInputRef}
               type='file'
               className='hidden'
               accept='.txt,.md,.pdf'
               onChange={(e) =>
                  e.target.files?.[0] && handleFileProcess(e.target.files[0])
               }
            />

            <div className='flex flex-col items-center justify-center space-y-4'>
               <div
                  className={`p-3 rounded-full bg-white dark:bg-slate-800 shadow-sm ${
                     isUploading
                        ? 'animate-pulse text-emerald-500'
                        : 'text-slate-400'
                  }`}
               >
                  <svg
                     className='w-8 h-8'
                     fill='none'
                     stroke='currentColor'
                     viewBox='0 0 24 24'
                  >
                     <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={1.5}
                        d='M12 16v-8m0 8l-4-4m4 4l4-4M4 4h16v16H4V4z'
                     />
                  </svg>
               </div>
               <div>
                  <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>
                     {isUploading
                        ? '正在推送解析管道...'
                        : '将本地文档拖拽至此，或点击浏览文件'}
                  </p>
                  <p className='text-xs text-slate-400 mt-1'>
                     支持文本和电子书格式：PDF, Markdown, TXT
                  </p>
               </div>
            </div>

            {isUploading && (
               <div className='mt-6 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden'>
                  <div
                     className='bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out'
                     style={{ width: `${uploadProgress}%` }}
                  />
               </div>
            )}
         </div>
      </div>
   );
};

import React from 'react';
import type { Message } from '../types';

export const ChatBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isAI = message.role === 'assistant';
  
  return (
    <div className={`flex w-full my-6 ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
        isAI 
        ? 'bg-gray-100 text-gray-800 rounded-bl-none' 
        : 'bg-black text-white rounded-br-none'
      }`}>
        <div className="font-semibold mb-1 text-[10px] uppercase tracking-widest opacity-50">
          {isAI ? 'DeepSeek AI' : 'You'}
        </div>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
};
import React, { useEffect, useState } from 'react';
import type { Task, TaskStatus } from '../task.type';
import { taskApi } from '../api';

export const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await taskApi.getAllTasks();
        setTasks(data);
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // --- 拖拽核心逻辑 ---
  
  // 1. 当开始拖拽时，记录当前任务的 ID
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
  };

  // 2. 放置目标响应：允许在该区域放下
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  // 3. 放下卡片时触发，捕获 ID 并调用后端 API 更新状态
  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (!taskId) return;

    // 乐观更新：先修改本地状态，保证视觉流畅
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetStatus } : t));

    try {
      // 同步后端数据库
      await taskApi.updateTask(taskId, { status: targetStatus });
    } catch (error) {
      console.error('Failed to update task status:', error);
      // 若后端失败，回滚状态
      setTasks(previousTasks);
    }
  };

  const columns: { title: string; status: TaskStatus; bgColor: string }[] = [
    { title: '待处理', status: 'Todo', bgColor: 'bg-slate-100' },
    { title: '进行中', status: 'In Progress', bgColor: 'bg-blue-50/50' },
    { title: '已完成', status: 'Done', bgColor: 'bg-emerald-50/50' },
  ];

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <div className="p-6 min-h-screen bg-slate-50">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Smart Task Board</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {columns.map((col) => {
          const filteredTasks = tasks.filter((task) => task.status === col.status);

          return (
            <div
              key={col.status}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
              className={`flex flex-col p-4 rounded-xl border border-slate-200/80 ${col.bgColor}  transition-colors`}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-slate-700">{col.title}</h2>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-200 text-slate-600">
                  {filteredTasks.length}
                </span>
              </div>

              <div className="flex-1 space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="flex justify-center items-center h-32 text-xs border-2 border-dashed border-slate-200 text-slate-400 rounded-xl">
                    释放卡片到此处
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm active:opacity-50 cursor-grab group transition-all hover:border-slate-300"
                    >
                      <h3 className="font-medium text-slate-800 text-sm mb-1">{task.title}</h3>
                      {task.description && <p className="text-xs text-slate-500">{task.description}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export type TaskStatus = 'Todo' | 'In Progress' | 'Done'

export interface Task {
   id: number;
   title: string;
   description: string;
   status: TaskStatus;
   created_at: string;
}

export interface TaskCreatePayLoad {
   title: string;
   description?: string;
}

export interface TaskUpdatePayLoad {
   title?: string;
   description?: string;
   status?: TaskStatus;
}
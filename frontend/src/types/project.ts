export interface Project {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export interface AdminProject extends Project {
  pdfPath: string;
}

export interface UnansweredQuestion {
  id: string;
  question: string;
  createdAt: string;
  reviewed: boolean;
  project: { id: string; title: string };
  user: { id: string; email: string } | null;
}

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import type { LinkedStudent } from '@/lib/types';

interface StudentSelectionValue {
  students: LinkedStudent[];
  studentId: string | null;
  selectedStudent: LinkedStudent | null;
  setStudentId: (id: string) => void;
  isParent: boolean;
}

const StudentSelectionContext = createContext<StudentSelectionValue | null>(null);

// PARENT birden fazla çocuğa sahip olabilir (bkz. StudentGuardian) — bu,
// (student) grubundaki ekranların "hangi öğrenciye bakıyoruz" sorusunu tek
// bir yerden cevaplamasını sağlar.
export function StudentSelectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const students = useMemo(() => user?.students ?? [], [user]);
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId && students.length > 0) {
      setStudentId(students[0].studentId);
    }
  }, [students, studentId]);

  const value: StudentSelectionValue = {
    students,
    studentId,
    selectedStudent: students.find((s) => s.studentId === studentId) ?? null,
    setStudentId,
    isParent: user?.role === 'PARENT',
  };

  return <StudentSelectionContext.Provider value={value}>{children}</StudentSelectionContext.Provider>;
}

export function useStudentSelection() {
  const ctx = useContext(StudentSelectionContext);
  if (!ctx) throw new Error('useStudentSelection, StudentSelectionProvider içinde kullanılmalıdır');
  return ctx;
}

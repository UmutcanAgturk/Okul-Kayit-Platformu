import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, CenterLoading, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { AttendanceRow, AttendanceStatus2, ClassroomOption } from '@/lib/types';

const STATUSES: { key: AttendanceStatus2; label: string; tone: 'success' | 'warning' | 'neutral' | 'critical' }[] = [
  { key: 'VAR', label: 'Var', tone: 'success' },
  { key: 'GEC', label: 'Geç', tone: 'warning' },
  { key: 'IZINLI', label: 'İzinli', tone: 'neutral' },
  { key: 'YOK', label: 'Yok', tone: 'critical' },
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function YoklamaScreen() {
  const classes = useApiQuery<{ classrooms: ClassroomOption[] }>('/api/branch/classrooms');
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const date = today();
  const roster = useApiQuery<{ students: AttendanceRow[] }>(
    classroomId ? `/api/branch/attendance?classroomId=${classroomId}&date=${date}` : null,
  );

  const [marks, setMarks] = useState<Record<string, AttendanceStatus2>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (roster.data?.students) {
      setMarks(Object.fromEntries(roster.data.students.map((r) => [r.studentId, r.status])));
    }
  }, [roster.data]);

  async function save() {
    if (!classroomId) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      const records = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }));
      await api.post('/api/branch/attendance', { classroomId, date, records });
      setMsg('Yoklama kaydedildi.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Kaydedilemedi');
    } finally { setSaving(false); }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Label>Sınıf Seç</Label>
      {classes.loading ? <CenterLoading /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(classes.data?.classrooms ?? []).map((c) => (
            <Chip key={c.id} label={c.name} tone="brand" selected={classroomId === c.id} onPress={() => setClassroomId(c.id)} />
          ))}
        </View>
      )}
      {classes.error && <ErrorBanner message={classes.error} />}

      {classroomId && (
        <>
          {roster.loading && <CenterLoading />}
          {roster.error && <ErrorBanner message={roster.error} />}
          {msg && <Chip label={msg} tone="success" />}
          {err && <ErrorBanner message={err} />}
          {(roster.data?.students.length ?? 0) === 0 && !roster.loading && <EmptyState message="Bu sınıfta öğrenci yok." />}
          {roster.data?.students.map((r) => (
            <Card key={r.studentId} style={{ gap: 8 }}>
              <Label>{r.name}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {STATUSES.map((s) => (
                  <Chip key={s.key} label={s.label} tone={s.tone} selected={marks[r.studentId] === s.key}
                    onPress={() => setMarks((m) => ({ ...m, [r.studentId]: s.key }))} />
                ))}
              </View>
            </Card>
          ))}
          {(roster.data?.students.length ?? 0) > 0 && (
            <Button title="Yoklamayı Kaydet" onPress={save} loading={saving} />
          )}
        </>
      )}
    </ScrollView>
  );
}

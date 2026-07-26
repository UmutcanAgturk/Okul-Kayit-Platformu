import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText, Title } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudySession } from '@/lib/types';

const STATUS_LABELS: Record<StudySession['status'], string> = {
  AI_SUGGESTED: 'AI Önerisi — Yanıt Bekliyor',
  TEACHER_APPROVED: 'Onaylandı',
  TEACHER_REJECTED: 'Reddedildi',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
};

const STATUS_TONE: Record<StudySession['status'], 'warning' | 'success' | 'critical' | 'neutral'> = {
  AI_SUGGESTED: 'warning',
  TEACHER_APPROVED: 'success',
  TEACHER_REJECTED: 'critical',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StudySessionsScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ sessions: StudySession[] }>(
    '/api/teacher/study-sessions',
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function respond(sessionId: string, decision: 'APPROVE' | 'REJECT') {
    setBusyId(sessionId);
    setActionError(null);
    try {
      await api.post(`/api/teacher/study-sessions/${sessionId}/respond`, { decision });
      await refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'İşlem başarısız oldu');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 4, gap: 8 }}>
          <Title>Etüt Seansları</Title>
          {error && <ErrorBanner message={error} />}
          {actionError && <ErrorBanner message={actionError} />}
        </View>
      }
      data={data?.sessions ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={!loading ? <EmptyState message="Etüt seansı bulunamadı." /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>
              {item.student.user ? `${item.student.user.firstName} ${item.student.user.lastName}` : 'Öğrenci'}
            </Label>
            <Chip label={STATUS_LABELS[item.status]} tone={STATUS_TONE[item.status]} />
          </View>
          {item.achievement && <MutedText>{item.achievement.code} — {item.achievement.label}</MutedText>}
          <MutedText>{formatDateTime(item.scheduledStart)}</MutedText>
          {item.status === 'AI_SUGGESTED' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Onayla"
                  onPress={() => respond(item.id, 'APPROVE')}
                  loading={busyId === item.id}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Reddet"
                  variant="danger"
                  onPress={() => respond(item.id, 'REJECT')}
                  loading={busyId === item.id}
                />
              </View>
            </View>
          )}
        </Card>
      )}
    />
  );
}

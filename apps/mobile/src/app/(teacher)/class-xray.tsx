import { useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  ErrorBanner,
  Field,
  Label,
  MutedText,
  Screen,
  Title,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { ClassXRayResponse, MasteryLevel } from '@/lib/types';

const MASTERY_TONE: Record<MasteryLevel, 'critical' | 'warning' | 'success'> = {
  CRITICAL: 'critical',
  WEAK: 'warning',
  STRONG: 'success',
};

export default function ClassXRayScreen() {
  const [examId, setExamId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [result, setResult] = useState<ClassXRayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!examId.trim() || !classroomId.trim()) {
      setError('Sınav ID ve sınıf ID zorunludur');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ClassXRayResponse>(
        `/api/teacher/exams/${examId.trim()}/class-xray?classroomId=${encodeURIComponent(classroomId.trim())}`,
      );
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : 'Beklenmeyen bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <Title>AI Sınıf Röntgeni</Title>
        <MutedText>
          Şu an bu ekran, sınav ve sınıf seçimini otomatik listelemiyor — sınav ID ve sınıf ID'sini
          web'deki ilgili ekrandan (veya kayıt sisteminden) alıp girmeniz gerekiyor.
        </MutedText>

        <Card style={{ gap: 12 }}>
          <Field label="Sınav ID" value={examId} onChangeText={setExamId} autoCapitalize="none" />
          <Field label="Sınıf ID" value={classroomId} onChangeText={setClassroomId} autoCapitalize="none" />
          {error && <ErrorBanner message={error} />}
          <Button title="Görüntüle" onPress={handleSubmit} loading={loading} />
        </Card>

        {result && (
          <>
            <Card style={{ gap: 6 }}>
              <Label>
                {result.examName} — {result.classroomName}
              </Label>
              <MutedText>Sınıf Ortalama Net: {result.classSummary.averageNet}</MutedText>
              <MutedText>
                En Zayıf Kazanım: {result.classSummary.weakestAchievement.label} (
                {Math.round(result.classSummary.weakestAchievement.classAverageRatio * 100)}%)
              </MutedText>
              <MutedText>
                En Güçlü Kazanım: {result.classSummary.strongestAchievement.label} (
                {Math.round(result.classSummary.strongestAchievement.classAverageRatio * 100)}%)
              </MutedText>
            </Card>

            <FlatList
              scrollEnabled={false}
              data={result.students}
              keyExtractor={(s) => s.studentId}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item }) => (
                <Card style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Label>{item.fullName}</Label>
                    <MutedText>Net: {item.overallNet}</MutedText>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {item.cells.length === 0 ? (
                      <MutedText>Sonuç yok</MutedText>
                    ) : (
                      item.cells.map((cell) => {
                        const col = result.achievementColumns.find(
                          (c) => c.achievementId === cell.achievementId,
                        );
                        return (
                          <Chip
                            key={cell.achievementId}
                            label={`${col?.code ?? '?'} ${Math.round(cell.correctRatio * 100)}%`}
                            tone={MASTERY_TONE[cell.masteryLevel]}
                          />
                        );
                      })
                    )}
                  </View>
                </Card>
              )}
            />
          </>
        )}
      </Screen>
    </ScrollView>
  );
}

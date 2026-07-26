import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button, Card, Chip, Label, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useStudentSelection } from '@/lib/student-selection';

export default function StudentHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { students, studentId, setStudentId, selectedStudent, isParent } = useStudentSelection();

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <View>
          <Title>Merhaba, {user?.firstName}</Title>
          <MutedText>{isParent ? 'Veli Portalı' : 'Öğrenci Portalı'}</MutedText>
        </View>

        {isParent && students.length > 1 && (
          <Card style={{ gap: 10 }}>
            <Label>Öğrenci</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {students.map((s) => (
                <Chip
                  key={s.studentId}
                  label={s.fullName}
                  tone="brand"
                  selected={s.studentId === studentId}
                  onPress={() => setStudentId(s.studentId)}
                />
              ))}
            </View>
          </Card>
        )}

        {students.length === 0 ? (
          <Card>
            <MutedText>
              Hesabınıza bağlı bir öğrenci kaydı bulunamadı. Şubenizle iletişime geçin.
            </MutedText>
          </Card>
        ) : (
          <Card style={{ gap: 10 }}>
            <Label>{selectedStudent?.fullName ?? '—'}</Label>
            <MutedText>Taksit durumunu görüntülemek için Taksitler sekmesine geçin.</MutedText>
            <Button
              title="Taksitleri Görüntüle"
              variant="secondary"
              onPress={() => router.push('/(student)/installments')}
            />
          </Card>
        )}
      </Screen>
    </ScrollView>
  );
}

-- Sınav Uygulaması: cevap anahtarı (bkz. app/api/branch/exams — ANSWER_KEY_OPTIONS
-- "A".."E"). Sonuç Girişi'nde referans olarak gösterilir; doğru/yanlış/boş
-- işaretlemesi yine elle girilir (kamera/OCR bazlı otomatik okuma kapsam dışı).
ALTER TABLE "ExamQuestion" ADD COLUMN "correctAnswer" TEXT;

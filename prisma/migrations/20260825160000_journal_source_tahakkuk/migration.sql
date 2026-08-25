-- Cari tahakkuk (accrual) kaynağı: TAHSILAT'tan önce eklenir.
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'TAHAKKUK' BEFORE 'TAHSILAT';

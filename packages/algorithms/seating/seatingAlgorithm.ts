import type {
  RoomSeatingResult,
  SeatAssignment,
  SeatingPlanResult,
  SeatingRoom,
  SeatingStudent,
} from "./types";

/**
 * Seviye 360 — Sınav Salonu Oturma Düzeni (Seating) Algoritması
 *
 * Garanti ettiği kural: bir öğrencinin komşusu (soldan, sağdan, önden,
 * arkadan VE çapraz — "kral hamlesi" komşuluğu) hiçbir zaman kendisiyle aynı
 * kitapçık türünü (A/B/C/D) almaz. Ayrıca mümkün olduğunca aynı kaynak
 * sınıftaki öğrenciler yan yana oturtulmaz.
 *
 * Yöntem:
 *  1) Öğrenciler, kaynak sınıflarına göre round-robin ile "iç içe geçirilir"
 *     (interleave) — böylece art arda gelen öğrenciler farklı sınıflardan olur.
 *  2) Her salon için satır x sütun kitapçık matrisi, 2x2 blok döşeme
 *     (checkerboard) yöntemiyle üretilir: type(row, col) = f(row % 2, col % 2).
 *     Bu döşemede herhangi iki "kral komşusu" hücre daima farklı (row%2, col%2)
 *     çiftine düşer, dolayısıyla daima farklı kitapçık türü alır (bkz. alttaki
 *     ispat notu).
 *  3) Öğrenciler, salonlara kapasite sırasına göre "Z-pattern" (boustrophedon /
 *     yılan) düzende, yani 1. satır soldan sağa, 2. satır sağdan sola, ...
 *     şeklinde yerleştirilir. Bu, sınav gözetmeninin sırayla yürüyerek kitapçık
 *     dağıtımını kontrol etmesini kolaylaştırır.
 *
 * İspat notu (adım 2): İki hücre "kral komşusu" ise aralarındaki satır farkı ve
 * sütun farkı {-1, 0, 1} kümesindedir ve ikisi birden 0 olamaz. Bu durumda en
 * az biri değişir; (row % 2, col % 2) çiftinin en az bir bileşeni de değişmiş
 * olur (0<->1). 2x2 matriste 4 hücrenin tamamı farklı kitapçık türü taşıdığı
 * için, çiftin herhangi bir bileşeninin değişmesi türün de değişmesini garanti
 * eder. Böylece 4 kitapçık türü için tam kapsamalı (adjacent-safe) bir dağıtım
 * elde edilir.
 */

const DEFAULT_BOOKLET_TYPES = ["A", "B", "C", "D"] as const;

/**
 * Aynı kaynak sınıftan öğrencilerin ardışık gelme olasılığını azaltmak için
 * öğrencileri sınıflarına göre gruplayıp round-robin sırayla karıştırır.
 */
function interleaveByClassroom(students: SeatingStudent[]): SeatingStudent[] {
  const groups = new Map<string, SeatingStudent[]>();
  for (const student of students) {
    const group = groups.get(student.sourceClassroom) ?? [];
    group.push(student);
    groups.set(student.sourceClassroom, group);
  }

  const queues = Array.from(groups.values());
  const interleaved: SeatingStudent[] = [];
  let remaining = students.length;

  let queueIndex = 0;
  while (remaining > 0) {
    const queue = queues[queueIndex % queues.length];
    if (queue.length > 0) {
      interleaved.push(queue.shift() as SeatingStudent);
      remaining -= 1;
    }
    queueIndex += 1;
  }

  return interleaved;
}

/**
 * rows x cols boyutunda, komşu hücrelerin (çapraz dahil) hiçbir zaman aynı
 * kitapçık türünü almadığı bir kitapçık matrisi üretir. 4 kitapçık türü
 * (A,B,C,D) için matematiksel olarak tam garantilidir.
 */
function buildBookletGrid(
  rows: number,
  cols: number,
  bookletTypes: readonly string[],
): string[][] {
  if (bookletTypes.length < 4) {
    throw new Error("Çakışma önleyici dağıtım için en az 4 kitapçık türü gereklidir.");
  }

  const grid: string[][] = [];
  for (let row = 0; row < rows; row++) {
    const rowTypes: string[] = [];
    for (let col = 0; col < cols; col++) {
      const blockIndex = (row % 2) * 2 + (col % 2); // 0,1,2,3
      rowTypes.push(bookletTypes[blockIndex]);
    }
    grid.push(rowTypes);
  }
  return grid;
}

/** Bir salonu Z-pattern (boustrophedon) sırayla dolduran koltuk koordinat listesi üretir. */
function buildSnakeSeatOrder(rows: number, cols: number): Array<{ row: number; col: number }> {
  const order: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < rows; row++) {
    const isEvenRow = row % 2 === 0;
    for (let i = 0; i < cols; i++) {
      const col = isEvenRow ? i : cols - 1 - i;
      order.push({ row, col });
    }
  }
  return order;
}

function seatLabel(row: number, col: number): string {
  return `R${row + 1}-K${col + 1}`;
}

export function planExamSeating(
  students: SeatingStudent[],
  rooms: SeatingRoom[],
  bookletTypes: readonly string[] = DEFAULT_BOOKLET_TYPES,
): SeatingPlanResult {
  const orderedStudents = interleaveByClassroom(students);
  const roomResults: RoomSeatingResult[] = [];

  let cursor = 0;

  for (const room of rooms) {
    const capacity = room.rows * room.cols;
    const bookletGrid = buildBookletGrid(room.rows, room.cols, bookletTypes);
    const seatOrder = buildSnakeSeatOrder(room.rows, room.cols);

    const grid: (SeatAssignment | null)[][] = Array.from({ length: room.rows }, () =>
      new Array(room.cols).fill(null),
    );
    const assignments: SeatAssignment[] = [];

    for (const { row, col } of seatOrder) {
      if (cursor >= orderedStudents.length) break;

      const student = orderedStudents[cursor];
      const assignment: SeatAssignment = {
        roomId: room.roomId,
        roomName: room.roomName,
        row,
        col,
        seatLabel: seatLabel(row, col),
        studentId: student.studentId,
        fullName: student.fullName,
        bookletType: bookletGrid[row][col],
      };

      grid[row][col] = assignment;
      assignments.push(assignment);
      cursor += 1;
    }

    roomResults.push({
      roomId: room.roomId,
      roomName: room.roomName,
      capacity,
      seatCount: assignments.length,
      assignments,
      grid,
    });
  }

  const unassignedStudents = orderedStudents.slice(cursor);

  return {
    rooms: roomResults,
    unassignedStudents,
    totalCapacity: rooms.reduce((sum, r) => sum + r.rows * r.cols, 0),
    totalAssigned: cursor,
  };
}

/**
 * Bir oturma planının çakışma kuralını gerçekten karşıladığını doğrular
 * (test / QA amaçlı). Herhangi bir ihlal bulunursa hata mesajlarını döner.
 */
export function validateSeatingPlan(plan: SeatingPlanResult): string[] {
  const violations: string[] = [];

  for (const room of plan.rooms) {
    const { grid } = room;
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const current = grid[row][col];
        if (!current) continue;

        const neighborOffsets = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1], [0, 1],
          [1, -1], [1, 0], [1, 1],
        ];

        for (const [dRow, dCol] of neighborOffsets) {
          const neighbor = grid[row + dRow]?.[col + dCol];
          if (neighbor && neighbor.bookletType === current.bookletType) {
            violations.push(
              `${room.roomName}: ${current.seatLabel} ve ${neighbor.seatLabel} aynı kitapçık türünü (${current.bookletType}) taşıyor.`,
            );
          }
        }
      }
    }
  }

  return violations;
}

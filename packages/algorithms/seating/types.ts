export interface SeatingStudent {
  studentId: string;
  fullName: string;
  /** Öğrencinin kayıtlı olduğu kaynak sınıf (örn. "9-A"). Aynı sınıftaki
   * öğrencilerin yan yana oturması istenmez; algoritma bunu da dağıtır. */
  sourceClassroom: string;
}

export interface SeatingRoom {
  roomId: string;
  roomName: string;
  rows: number;
  cols: number;
}

export interface SeatAssignment {
  roomId: string;
  roomName: string;
  row: number; // 0-index
  col: number; // 0-index
  seatLabel: string; // örn. "R3-K2" (Row 3, Column 2)
  studentId: string;
  fullName: string;
  bookletType: string;
}

export interface RoomSeatingResult {
  roomId: string;
  roomName: string;
  capacity: number;
  seatCount: number;
  assignments: SeatAssignment[];
  /** rows x cols grid; boş koltuklar null'dır. Salon krokisi render'ı içindir. */
  grid: (SeatAssignment | null)[][];
}

export interface SeatingPlanResult {
  rooms: RoomSeatingResult[];
  unassignedStudents: SeatingStudent[];
  totalCapacity: number;
  totalAssigned: number;
}

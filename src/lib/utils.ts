
import { addDays, isWeekend, differenceInMinutes, startOfDay, addMinutes, isAfter, isBefore, setHours, setMinutes } from "date-fns";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Brazilian National Holidays (Fixed Days)
const FIXED_HOLIDAYS = [
    '01-01', // Ano Novo
    '04-21', // Tiradentes
    '05-01', // Dia do Trabalho
    '09-07', // Independência
    '10-12', // N. Sra. Aparecida
    '11-02', // Finados
    '11-15', // Proclamação da República
    '11-20', // Consciência Negra
    '12-25', // Natal
];

// Helper to calculate Easter Sunday for a given year (Meeus/Jones/Butcher's Algorithm)
function getEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function getMovableHolidays(year: number): string[] {
    const easter = getEasterSunday(year);
    const carnivalMon = addDays(easter, -48);
    const carnivalTue = addDays(easter, -47);
    const goodFriday = addDays(easter, -2);
    const corpusChristi = addDays(easter, 60);

    const fmt = (d: Date) => {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${month}-${day}`;
    };

    return [
        fmt(carnivalMon),
        fmt(carnivalTue),
        fmt(goodFriday),
        fmt(corpusChristi)
    ];
}

const movableCache: Record<number, string[]> = {};

export function checkIsHoliday(date: Date): boolean {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${month}-${day}`;
    const year = date.getFullYear();

    if (FIXED_HOLIDAYS.includes(dateStr)) return true;

    if (!movableCache[year]) {
        movableCache[year] = getMovableHolidays(year);
    }
    return movableCache[year].includes(dateStr);
}

export function calculateBusinessDays(startDate: Date, endDate: Date): number {
    if (startDate > endDate) return 0;

    let count = 0;
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        if (!isWeekend(current) && !checkIsHoliday(current)) {
            count++;
        }
        current = addDays(current, 1);
    }

    return count;
}

// ----- Business Logic Config -----
const WORK_START_HOUR = 9; // 09:00
const WORK_END_HOUR = 17;   // 17:00 (Total 8h)

export function calculateBusinessHours(start: Date, end: Date): number {
    if (start > end) return 0;

    let totalMinutes = 0;
    let current = new Date(start);
    current.setHours(0, 0, 0, 0);

    const final = new Date(end);
    final.setHours(0, 0, 0, 0);

    while (current <= final) {
        if (!isWeekend(current) && !checkIsHoliday(current)) {
            // Day limits
            const dayStart = new Date(current);
            dayStart.setHours(WORK_START_HOUR, 0, 0, 0);

            const dayEnd = new Date(current);
            dayEnd.setHours(WORK_END_HOUR, 0, 0, 0);

            // Compare with range
            const windowStart = isAfter(start, dayStart) ? start : dayStart;
            const windowEnd = isBefore(end, dayEnd) ? end : dayEnd;

            if (windowStart < windowEnd) {
                totalMinutes += differenceInMinutes(windowEnd, windowStart);
            }
        }
        current = addDays(current, 1);
    }

    return Number((totalMinutes / 60).toFixed(1));
}

export function addBusinessHours(date: Date, hoursToAdd: number): Date {
    if (hoursToAdd <= 0) return date;

    let minutesRemaining = hoursToAdd * 60;
    let current = new Date(date);

    while (minutesRemaining > 0) {
        // Validation: Ensure current time is within working hours
        // If before start, move to start
        if (current.getHours() < WORK_START_HOUR) {
            current.setHours(WORK_START_HOUR, 0, 0, 0);
        }
        // If after end, move to next day start
        if (current.getHours() >= WORK_END_HOUR) {
            current = addDays(current, 1);
            current.setHours(WORK_START_HOUR, 0, 0, 0);
            continue; // Loop check will handle weekend/holiday
        }

        // Check availability of day
        if (isWeekend(current) || checkIsHoliday(current)) {
            current = addDays(current, 1);
            current.setHours(WORK_START_HOUR, 0, 0, 0);
            continue;
        }

        // Available minutes in THIS day
        const dayEnd = new Date(current);
        dayEnd.setHours(WORK_END_HOUR, 0, 0, 0);

        const availableMinutes = differenceInMinutes(dayEnd, current);

        if (availableMinutes > minutesRemaining) {
            // Can finish today
            current = addMinutes(current, minutesRemaining);
            minutesRemaining = 0;
        } else {
            // Consume rest of day and move to next
            current = addDays(current, 1);
            current.setHours(WORK_START_HOUR, 0, 0, 0);
            minutesRemaining -= availableMinutes;
        }
    }

    return current;
}

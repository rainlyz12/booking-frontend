import {
  createBookingCalendarEvent,
  filterRooms,
  formatBookingDuration,
  hasTimeConflict,
  splitBookings,
} from './bookingUtils'

describe('filterRooms', () => {
  const rooms = [
    { id: 1, name: 'สนามแบดมินตัน A', type: 'badminton', capacity: 4, description: 'ในร่ม' },
    { id: 2, name: 'สนามฟุตซอล', type: 'football', capacity: 10, description: 'หญ้าเทียม' },
  ]

  test('filters by type, search text, and minimum player capacity together', () => {
    expect(filterRooms(rooms, { type: 'แบดมินตัน', search: 'ในร่ม', minCapacity: 4 })).toEqual([rooms[0]])
    expect(filterRooms(rooms, { minCapacity: 11 })).toEqual([])
  })
})

describe('booking time conflicts', () => {
  const occupied = [{ start_time: '09:00:00', end_time: '10:00:00' }]

  test('blocks overlapping periods but allows adjacent periods', () => {
    expect(hasTimeConflict('09:30', '10:30', occupied)).toBe(true)
    expect(hasTimeConflict('10:00', '11:00', occupied)).toBe(false)
    expect(hasTimeConflict('08:00', '09:00', occupied)).toBe(false)
  })
})

test('formats booking duration for the confirmation summary', () => {
  expect(formatBookingDuration('09:00', '10:30')).toBe('1 ชม. 30 นาที')
  expect(formatBookingDuration('09:00', '09:30')).toBe('30 นาที')
})

describe('splitBookings', () => {
  test('groups pending, upcoming, and historical bookings', () => {
    const bookings = [
      { id: 1, status: 'pending', booking_date: '2026-11-10' },
      { id: 2, status: 'approved', booking_date: '2026-11-13' },
      { id: 3, status: 'confirmed', booking_date: '2026-11-09' },
      { id: 4, status: 'cancelled', booking_date: '2026-11-13' },
    ]

    expect(splitBookings(bookings, '2026-11-12')).toEqual({
      pending: [bookings[0]],
      upcoming: [bookings[1]],
      history: [bookings[2], bookings[3]],
    })
  })
})

describe('createBookingCalendarEvent', () => {
  test('exports Bangkok booking times as UTC and escapes calendar text', () => {
    const ics = createBookingCalendarEvent({
      id: 42,
      booking_date: '2026-11-13',
      start_time: '09:00:00',
      end_time: '10:30:00',
      status: 'approved',
      note: 'team, A',
    }, 'สนาม; A')

    expect(ics).toContain('DTSTART:20261113T020000Z')
    expect(ics).toContain('DTEND:20261113T033000Z')
    expect(ics).toContain('SUMMARY:จองสนาม: สนาม\\; A')
    expect(ics).toContain('DESCRIPTION:team\\, A')
    expect(ics.endsWith('\r\n')).toBe(true)
  })
})

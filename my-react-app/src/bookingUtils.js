const roomTypeLabels = {
  room: 'ห้องประชุม',
  badminton: 'แบดมินตัน',
  football: 'ฟุตซอล',
  basketball: 'บาสเกตบอล',
}

export function getTodayInBangkok() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function filterRooms(rooms, { type = 'ทั้งหมด', search = '', minCapacity = 0 } = {}) {
  const query = search.trim().toLowerCase()
  return rooms.filter((room) => {
    const roomType = roomTypeLabels[room.type?.toLowerCase()] || room.type || 'พื้นที่ให้บริการ'
    const matchesType = type === 'ทั้งหมด' || roomType === type
    const matchesSearch = `${room.name} ${roomType} ${room.description || ''}`.toLowerCase().includes(query)
    const matchesCapacity = !minCapacity || (room.capacity || 0) >= Number(minCapacity)
    return matchesType && matchesSearch && matchesCapacity
  })
}

export function hasTimeConflict(startTime, endTime, occupied = []) {
  if (!startTime || !endTime || endTime <= startTime) return false
  return occupied.some((period) => startTime < period.end_time.slice(0, 5) && endTime > period.start_time.slice(0, 5))
}

export function formatBookingDuration(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
  if (minutes <= 0) return 'ระยะเวลาไม่ถูกต้อง'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return [hours > 0 && `${hours} ชม.`, remainingMinutes > 0 && `${remainingMinutes} นาที`].filter(Boolean).join(' ')
}

export function splitBookings(bookings, today = getTodayInBangkok()) {
  const pending = bookings.filter((booking) => booking.status === 'pending')
  const upcoming = bookings.filter((booking) => (
    ['approved', 'confirmed'].includes(booking.status) && booking.booking_date >= today
  ))
  const history = bookings.filter((booking) => !pending.includes(booking) && !upcoming.includes(booking))
  return { pending, upcoming, history }
}

function escapeCalendarText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function bangkokDateTimeToUtc(date, time) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute))
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

export function createBookingCalendarEvent(booking, roomName) {
  const event = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sanamdee//Sports Booking//TH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:booking-${booking.id}@sanamdee`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART:${bangkokDateTimeToUtc(booking.booking_date, booking.start_time)}`,
    `DTEND:${bangkokDateTimeToUtc(booking.booking_date, booking.end_time)}`,
    `SUMMARY:${escapeCalendarText(`จองสนาม: ${roomName}`)}`,
    `DESCRIPTION:${escapeCalendarText(booking.note || `สถานะ: ${booking.status}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${event.join('\r\n')}\r\n`
}

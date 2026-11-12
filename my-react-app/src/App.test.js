import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { getTodayInBangkok } from './bookingUtils'

function getTomorrowInBangkok() {
  const date = new Date(`${getTodayInBangkok()}T00:00:00+07:00`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function jsonResponse(payload, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  }
}

describe('booking flow', () => {
  beforeEach(() => {
    sessionStorage.setItem('bookingToken', 'test-token')
    global.fetch = jest.fn((url, options = {}) => {
      if (url.endsWith('/api/rooms')) {
        return Promise.resolve(jsonResponse([{
          id: 3,
          name: 'สนามแบดมินตัน 1',
          type: 'badminton',
          capacity: 4,
          description: 'สนามในร่ม',
          image_url: null,
        }]))
      }
      if (url.endsWith('/api/auth/profile')) {
        return Promise.resolve(jsonResponse({ id: 1, name: 'Test Member', email: 'member@example.com', role: 'member' }))
      }
      if (url.includes('/api/rooms/3/availability')) {
        return Promise.resolve(jsonResponse({ room_id: 3, booking_date: getTomorrowInBangkok(), occupied: [] }))
      }
      if (url.endsWith('/api/bookings') && options.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 21, status: 'pending' }, 201))
      }
      throw new Error(`Unexpected API request: ${url}`)
    })
  })

  afterEach(() => {
    sessionStorage.clear()
    jest.restoreAllMocks()
  })

  test('shows four hero images and lets the visitor cycle through them', async () => {
    render(<App />)

    expect(await screen.findByRole('img', { name: 'สนามบาสเกตบอลในร่มพร้อมแป้นบาส' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ภาพถัดไป' }))
    expect(screen.getByRole('img', { name: 'สนามแบดมินตันในร่ม' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'แสดงภาพที่ 4: ห้องประชุม' }))
    expect(screen.getByRole('img', { name: 'ห้องประชุมพร้อมโต๊ะและเก้าอี้' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ภาพถัดไป' }))
    expect(screen.getByRole('img', { name: 'สนามบาสเกตบอลในร่มพร้อมแป้นบาส' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ภาพก่อนหน้า' }))
    expect(screen.getByRole('img', { name: 'ห้องประชุมพร้อมโต๊ะและเก้าอี้' })).toBeInTheDocument()
  })

  test('explains the booking steps and links the footer to the guide', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'วิธีจองสนาม ทีละขั้นตอน' })).toBeInTheDocument()
    expect(screen.getByText(/ระบบจะพากลับมาจองต่อหลังล็อกอิน/)).toBeInTheDocument()
    expect(screen.getByText(/คำขอใหม่จะเป็นสถานะ “รอยืนยัน”/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'วิธีจอง' })).toHaveAttribute('href', '#booking-guide')
  })

  test('loads a room, confirms the booking summary, and submits the request', async () => {
    render(<App />)

    expect(await screen.findByText('สนามแบดมินตัน 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'จองสนาม' }))
    expect(await screen.findByText('ยังไม่มีช่วงเวลาที่ถูกจองในวันที่เลือก')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('วันที่ต้องการจอง'), { target: { value: getTomorrowInBangkok() } })
    fireEvent.change(screen.getByLabelText('เวลาเริ่ม'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('เวลาสิ้นสุด'), { target: { value: '11:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบและไปหน้ายืนยัน/ }))

    expect(await screen.findByText('ตรวจสอบข้อมูลก่อนส่งคำขอ')).toBeInTheDocument()
    expect(screen.getByText('10:00–11:00')).toBeInTheDocument()
    expect(screen.getByText('1 ชม.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการจอง' }))

    expect(await screen.findByText('ส่งคำขอจองแล้ว')).toBeInTheDocument()
    await waitFor(() => {
      const request = global.fetch.mock.calls.find(([url, options]) => url.endsWith('/api/bookings') && options.method === 'POST')
      expect(JSON.parse(request[1].body)).toEqual({
        room_id: 3,
        booking_date: getTomorrowInBangkok(),
        start_time: '10:00',
        end_time: '11:00',
        note: '',
      })
    })
  })

  test('keeps the selected booking open after signing in', async () => {
    sessionStorage.clear()
    const apiFetch = global.fetch.getMockImplementation()
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/api/auth/login')) {
        return Promise.resolve(jsonResponse({
          token: 'signed-in-token',
          user: { id: 1, name: 'Test Member', email: 'member@example.com', role: 'member' },
        }))
      }
      return apiFetch(url, options)
    })
    render(<App />)

    expect(await screen.findByText('สนามแบดมินตัน 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'จองสนาม' }))
    expect(await screen.findByRole('dialog', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'member@example.com' } })
    fireEvent.change(screen.getByLabelText(/รหัสผ่าน/), { target: { value: 'password123' } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'เข้าสู่ระบบ' })).getByRole('button', { name: 'เข้าสู่ระบบ' }))

    expect(await screen.findByRole('dialog', { name: 'สนามแบดมินตัน 1' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'เข้าสู่ระบบ' })).not.toBeInTheDocument())
  })

  test('recovers from a 409 by refreshing availability and returning to edit mode', async () => {
    const apiFetch = global.fetch.getMockImplementation()
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/api/bookings') && options.method === 'POST') {
        return Promise.resolve(jsonResponse({ error: 'room is already booked during this time' }, 409))
      }
      return apiFetch(url, options)
    })
    render(<App />)

    expect(await screen.findByText('สนามแบดมินตัน 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'จองสนาม' }))
    expect(await screen.findByText('ยังไม่มีช่วงเวลาที่ถูกจองในวันที่เลือก')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('วันที่ต้องการจอง'), { target: { value: getTomorrowInBangkok() } })
    fireEvent.change(screen.getByLabelText('เวลาเริ่ม'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('เวลาสิ้นสุด'), { target: { value: '11:00' } })
    fireEvent.click(screen.getByRole('button', { name: /ตรวจสอบและไปหน้ายืนยัน/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'ยืนยันการจอง' }))

    expect(await screen.findByText('ช่วงเวลานี้เพิ่งมีผู้จอง กรุณาเลือกเวลาอื่น (อัปเดตเวลาที่ถูกจองแล้ว)')).toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch.mock.calls.filter(([url]) => url.includes('/api/rooms/3/availability'))).toHaveLength(2)
    })
    expect(screen.getByRole('button', { name: /ตรวจสอบและไปหน้ายืนยัน/ })).toBeInTheDocument()
  })

  test('changes the password, clears the session, and requests a fresh login', async () => {
    const apiFetch = global.fetch.getMockImplementation()
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/api/auth/password') && options.method === 'PUT') {
        return Promise.resolve(jsonResponse(null, 204))
      }
      return apiFetch(url, options)
    })
    render(<App />)

    await screen.findByText('สนามแบดมินตัน 1')
    fireEvent.click(screen.getByRole('button', { name: 'รหัสผ่าน' }))
    fireEvent.change(screen.getByLabelText('รหัสผ่านปัจจุบัน'), { target: { value: 'oldPassword1' } })
    fireEvent.change(screen.getByLabelText('รหัสผ่านใหม่'), { target: { value: 'newPassword2' } })
    fireEvent.change(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), { target: { value: 'newPassword2' } })
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }))

    expect(await screen.findByText('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่')).toBeInTheDocument()
    expect(sessionStorage.getItem('bookingToken')).toBeNull()
    const request = global.fetch.mock.calls.find(([url, options]) => url.endsWith('/api/auth/password') && options.method === 'PUT')
    expect(JSON.parse(request[1].body)).toEqual({
      current_password: 'oldPassword1',
      new_password: 'newPassword2',
    })
  })
})

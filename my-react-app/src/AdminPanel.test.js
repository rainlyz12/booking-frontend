import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdminPanel from './AdminPanel'
import { getTodayInBangkok } from './bookingUtils'

function jsonResponse(payload) {
  return {
    status: 200,
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  }
}

function getTomorrowInBangkok() {
  const date = new Date(`${getTodayInBangkok()}T00:00:00+07:00`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

test('loads the selected date and groups admin bookings by venue', async () => {
  global.fetch = jest.fn((url) => {
    if (url.endsWith('/api/admin/rooms')) {
      return Promise.resolve(jsonResponse([{ id: 3, name: 'สนามแบดมินตัน 1', type: 'badminton' }]))
    }
    if (url.includes('/api/admin/bookings?date=')) {
      return Promise.resolve(jsonResponse([{
        id: 9,
        room_id: 3,
        user_id: 4,
        booking_date: getTodayInBangkok(),
        start_time: '10:00:00',
        end_time: '11:00:00',
        status: 'pending',
      }]))
    }
    throw new Error(`Unexpected API request: ${url}`)
  })

  render(<AdminPanel token="admin-token" onClose={() => {}} onRoomsChanged={async () => {}} />)

  expect(await screen.findByRole('heading', { level: 4, name: 'สนามแบดมินตัน 1' })).toBeInTheDocument()
  expect(screen.getByText('10:00–11:00')).toBeInTheDocument()
  expect(screen.getAllByText('รอยืนยัน')).toHaveLength(2)
  const dateInput = screen.getByLabelText('เลือกวันที่')
  fireEvent.change(dateInput, { target: { value: getTomorrowInBangkok() } })

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/admin/bookings?date=${getTomorrowInBangkok()}`),
      expect.objectContaining({ headers: expect.anything() }),
    )
  })
})

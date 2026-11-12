import { useEffect, useState } from 'react'
import { apiRequest } from './api'
import { getTodayInBangkok } from './bookingUtils'

const emptyRoom = {
  name: '',
  type: '',
  capacity: '',
  description: '',
  image_url: '',
}

function formatTime(time) {
  return time?.slice(0, 5) || '--:--'
}

function formatStatus(status) {
  return {
    pending: 'รอยืนยัน',
    approved: 'อนุมัติแล้ว',
    confirmed: 'ยืนยันแล้ว',
    rejected: 'ไม่อนุมัติ',
    cancelled: 'ยกเลิกแล้ว',
  }[status] || status
}

async function fetchAdminData(token, date, signal) {
  const [rooms, bookings] = await Promise.all([
    apiRequest('/api/admin/rooms', { token, signal }),
    apiRequest(`/api/admin/bookings?date=${encodeURIComponent(date)}`, { token, signal }),
  ])
  if (!Array.isArray(rooms) || !Array.isArray(bookings)) {
    throw new Error('รูปแบบข้อมูลจาก API ไม่ถูกต้อง')
  }
  return { rooms, bookings }
}

function AdminPanel({ token, onClose, onRoomsChanged }) {
  const [rooms, setRooms] = useState([])
  const [bookings, setBookings] = useState([])
  const [calendarDate, setCalendarDate] = useState(getTodayInBangkok)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [roomForm, setRoomForm] = useState(emptyRoom)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomError, setRoomError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyAction, setBusyAction] = useState('')

  async function loadAdminData(date = calendarDate) {
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchAdminData(token, date)
      setRooms(data.rooms)
      setBookings(data.bookings)
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchAdminData(token, calendarDate, controller.signal)
      .then(({ rooms: roomResult, bookings: bookingResult }) => {
        setRooms(roomResult)
        setBookings(bookingResult)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token, calendarDate])

  const bookingsByRoom = new Map()
  for (const booking of bookings) {
    const roomBookings = bookingsByRoom.get(booking.room_id) || []
    roomBookings.push(booking)
    bookingsByRoom.set(booking.room_id, roomBookings)
  }
  const calendarRooms = [
    ...rooms,
    ...[...bookingsByRoom.keys()]
      .filter((roomId) => !rooms.some((room) => room.id === roomId))
      .map((roomId) => ({ id: roomId, name: `สถานที่ #${roomId}` })),
  ]

  function getTimelinePosition(time) {
    const [hour, minute] = time.split(':').map(Number)
    return ((hour * 60 + minute) / 1440) * 100
  }

  function startEditingRoom(room) {
    setEditingRoom(room)
    setRoomForm({
      name: room.name || '',
      type: room.type || '',
      capacity: room.capacity == null ? '' : String(room.capacity),
      description: room.description || '',
      image_url: room.image_url || '',
    })
    setRoomError('')
  }

  function resetRoomForm() {
    setEditingRoom(null)
    setRoomForm(emptyRoom)
    setRoomError('')
  }

  async function saveRoom(event) {
    event.preventDefault()
    setRoomError('')
    setBusyAction('room')
    const formData = new FormData(event.currentTarget)
    const capacity = String(formData.get('capacity') || '').trim()
    const body = {
      name: String(formData.get('name') || '').trim(),
      type: String(formData.get('type') || '').trim(),
      capacity: capacity ? Number(capacity) : null,
      description: String(formData.get('description') || '').trim() || null,
      image_url: String(formData.get('image_url') || '').trim() || null,
    }

    try {
      await apiRequest(editingRoom ? `/api/admin/rooms/${editingRoom.id}` : '/api/admin/rooms', {
        method: editingRoom ? 'PUT' : 'POST',
        token,
        body: JSON.stringify(body),
      })
      resetRoomForm()
      await Promise.all([loadAdminData(), onRoomsChanged()])
    } catch (error) {
      setRoomError(error.message)
    } finally {
      setBusyAction('')
    }
  }

  async function deactivateRoom(room) {
    if (!window.confirm(`ซ่อนสถานที่ "${room.name}" จากรายการจองหรือไม่?`)) return
    setActionError('')
    setBusyAction(`room-${room.id}`)
    try {
      await apiRequest(`/api/admin/rooms/${room.id}`, { method: 'DELETE', token })
      await Promise.all([loadAdminData(), onRoomsChanged()])
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusyAction('')
    }
  }

  async function reviewBooking(booking, status) {
    setActionError('')
    setBusyAction(`booking-${booking.id}`)
    try {
      await apiRequest(`/api/admin/bookings/${booking.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ status }),
      })
      await loadAdminData()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusyAction('')
    }
  }

  async function cancelBooking(booking) {
    if (!window.confirm(`ยกเลิกรายการจอง #${booking.id} หรือไม่?`)) return
    setActionError('')
    setBusyAction(`booking-${booking.id}`)
    try {
      await apiRequest(`/api/admin/bookings/${booking.id}`, { method: 'DELETE', token })
      await loadAdminData()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-title" className="max-h-[94vh] w-full max-w-[1080px] overflow-y-auto rounded-t-2xl bg-[#f5f4ef] p-5 shadow-2xl sm:rounded-2xl sm:p-7 lg:p-8">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#dedbd1] pb-5">
          <div><p className="mb-1 text-[19px] font-bold tracking-[.14em] text-[#a76d34]">ADMINISTRATION</p><h2 id="admin-title" className="m-0 text-[27px] font-black leading-tight text-[#24251f] sm:text-[32px]">จัดการสนามและรายการจอง</h2><p className="mb-0 mt-2 text-[19px] leading-relaxed text-[#68675f]">ตรวจสอบตาราง อนุมัติคำขอ และจัดการข้อมูลสนามได้ในหน้านี้</p></div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8d5cc] bg-white text-[28px] leading-none text-[#45463f] transition hover:bg-[#ebe9e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a76d34]" aria-label="ปิดหน้าต่าง">×</button>
        </div>

        {loadError && <div role="alert" className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-[19px] leading-relaxed text-red-800">{loadError}<button type="button" onClick={loadAdminData} className="ml-2 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">ลองอีกครั้ง</button></div>}
        {actionError && <p role="alert" className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-[19px] leading-relaxed text-red-800">{actionError}</p>}
        {loading ? <p role="status" className="rounded-lg border border-[#dedbd1] bg-white py-12 text-center text-[19px] text-[#68675f]">กำลังโหลดข้อมูลผู้ดูแล…</p> : <>
          <section className="mb-7 rounded-xl border border-[#dedbd1] bg-white p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div><h3 className="m-0 text-[23px] font-black leading-tight text-[#24251f] sm:text-[25px]">ตารางจองรายวัน</h3><p className="mb-0 mt-1 text-[19px] text-[#68675f]">{bookings.length} รายการในวันที่เลือก</p></div>
              <label className="flex flex-col gap-1 text-[19px] font-bold text-[#4b4b44]">เลือกวันที่<input type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value)} className="min-h-12 rounded-md border border-[#cbc8be] bg-white px-3 text-[19px] font-normal text-[#24251f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a76d34]" /></label>
            </div>
            <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[19px] text-[#55554e]" aria-label="สีสถานะการจอง">
              <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm bg-[#df8c37]" />รอยืนยัน</span>
              <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm bg-[#517b62]" />อนุมัติแล้ว / ยืนยันแล้ว</span>
            </div>
            {calendarRooms.length === 0 ? <p className="m-0 rounded-lg border border-dashed border-[#d8d5cc] bg-[#fbfaf7] p-6 text-center text-[19px] text-[#68675f]">ยังไม่มีสนามในระบบ</p> : <div className="space-y-4">{calendarRooms.map((room) => {
              const roomBookings = bookingsByRoom.get(room.id) || []
              return <article key={room.id} className="rounded-lg border border-[#e5e2d9] bg-[#fbfaf7] p-4">
                <h4 className="mb-3 mt-0 text-[20px] font-black text-[#24251f]">{room.name}</h4>
                <div className="overflow-x-auto">
                <div className="min-w-[520px]">
                <div className="mb-2 flex justify-between px-1 text-[19px] text-[#68675f]"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
                <div className="relative mb-3 h-9 overflow-hidden rounded-sm border-y border-[#e5e2d9] bg-white">
                  {[25, 50, 75].map((position) => <span key={position} aria-hidden="true" className="absolute inset-y-0 border-l border-[#e5e2d9]" style={{ left: `${position}%` }} />)}
                  {roomBookings.filter((booking) => ['pending', 'approved', 'confirmed'].includes(booking.status)).map((booking) => {
                    const start = getTimelinePosition(booking.start_time)
                    const end = getTimelinePosition(booking.end_time)
                    return <span key={booking.id} title={`${formatTime(booking.start_time)}–${formatTime(booking.end_time)} · ${formatStatus(booking.status)}`} className={`absolute top-0 z-10 h-full min-w-[3px] border-x border-white/60 ${booking.status === 'pending' ? 'bg-[#df8c37]' : 'bg-[#517b62]'}`} style={{ left: `${start}%`, width: `${Math.max(end - start, 0.4)}%` }} />
                  })}
                </div>
                </div>
                </div>
                {roomBookings.length === 0 ? <p className="mb-0 text-[19px] text-[#77766e]">ไม่มีรายการจอง</p> : <div className="mt-4 space-y-3">{roomBookings.map((booking) => {
                  const busy = busyAction === `booking-${booking.id}`
                  return <div key={booking.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#e9e6dd] bg-white p-3 sm:p-4">
                    <div className="min-w-[220px] flex-1">
                      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[19px] font-bold text-[#24251f]"><span>{formatTime(booking.start_time)}–{formatTime(booking.end_time)}</span><span aria-hidden="true" className="text-[#aaa79d]">·</span><span className={`rounded-full px-3 py-1 text-[19px] ${booking.status === 'pending' ? 'bg-[#fff0dc] text-[#8a4b0d]' : booking.status === 'rejected' || booking.status === 'cancelled' ? 'bg-[#f3e8e6] text-[#8b3b32]' : 'bg-[#e7f0e9] text-[#315d40]'}`}>{formatStatus(booking.status)}</span><span className="text-[#68675f]">#{booking.id}</span></p>
                      <p className="mb-0 mt-2 break-words text-[19px] text-[#68675f]">สมาชิก #{booking.user_id}{booking.note ? ` · ${booking.note}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {booking.status === 'pending' && <><button type="button" disabled={busy} onClick={() => reviewBooking(booking, 'approved')} className="min-h-12 rounded-md bg-[#1c1d19] px-4 py-2 text-[19px] font-bold text-white transition hover:bg-[#36362f] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a76d34]">{busy ? 'กำลังบันทึก…' : 'อนุมัติ'}</button><button type="button" disabled={busy} onClick={() => reviewBooking(booking, 'rejected')} className="min-h-12 rounded-md border border-[#d8d5cc] bg-white px-4 py-2 text-[19px] font-bold text-[#45463f] transition hover:bg-[#f5f4ef] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a76d34]">ปฏิเสธ</button></>}
                      {['pending', 'approved', 'confirmed'].includes(booking.status) && <button type="button" disabled={busy} onClick={() => cancelBooking(booking)} className="min-h-12 rounded-md border border-red-200 bg-white px-4 py-2 text-[19px] font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">ยกเลิก</button>}
                    </div>
                  </div>
                })}</div>}
              </article>
            })}</div>}
          </section>

          <section className="grid items-start gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-[#dedbd1] bg-white p-4 sm:p-6">
              <div className="mb-4"><h3 className="m-0 text-[23px] font-black leading-tight text-[#24251f]">{editingRoom ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่'}</h3><p className="mb-0 mt-1 text-[19px] text-[#68675f]">กรอกรายละเอียดที่ต้องการแสดงในหน้าจอง</p></div>
              <form onSubmit={saveRoom} className="space-y-4">
                <label className="block text-[19px] font-bold text-[#4b4b44]">ชื่อสถานที่<input name="name" value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} required maxLength="200" className="mt-1.5 block min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2 text-[19px] font-normal text-[#24251f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a76d34]" /></label>
                <label className="block text-[19px] font-bold text-[#4b4b44]">ประเภท<input name="type" value={roomForm.type} onChange={(event) => setRoomForm({ ...roomForm, type: event.target.value })} required maxLength="100" placeholder="เช่น badminton" className="mt-1.5 block min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 text-[19px] font-normal text-[#24251f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a76d34]" /></label>
                <label className="block text-[19px] font-bold text-[#4b4b44]">ความจุ<input name="capacity" type="number" min="1" value={roomForm.capacity} onChange={(event) => setRoomForm({ ...roomForm, capacity: event.target.value })} className="mt-1.5 block min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 text-[19px] font-normal text-[#24251f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a76d34]" /></label>
                <label className="block text-[19px] font-bold text-[#4b4b44]">รายละเอียด<textarea name="description" rows="3" value={roomForm.description} onChange={(event) => setRoomForm({ ...roomForm, description: event.target.value })} className="mt-1.5 block w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2 text-[19px] font-normal text-[#24251f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a76d34]" /></label>
                <label className="block text-[19px] font-bold text-[#4b4b44]">URL รูปภาพ<input name="image_url" type="url" value={roomForm.image_url} onChange={(event) => setRoomForm({ ...roomForm, image_url: event.target.value })} className="mt-1.5 block min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 text-[19px] font-normal text-[#24251f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a76d34]" /></label>
                {roomError && <p role="alert" className="m-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[19px] leading-relaxed text-red-800">{roomError}</p>}
                <div className="flex flex-wrap gap-2 pt-1"><button type="submit" disabled={busyAction === 'room'} className="min-h-12 flex-1 rounded-md bg-[#df8c37] px-4 py-2.5 text-[19px] font-black text-[#1c1d19] transition hover:bg-[#e8a052] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a76d34]">{busyAction === 'room' ? 'กำลังบันทึก…' : editingRoom ? 'บันทึกการแก้ไข' : 'เพิ่มสถานที่'}</button>{editingRoom && <button type="button" onClick={resetRoomForm} className="min-h-12 rounded-md border border-[#d8d5cc] bg-white px-4 py-2.5 text-[19px] font-bold text-[#45463f] transition hover:bg-[#f5f4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a76d34]">ยกเลิก</button>}</div>
              </form>
            </div>

            <div className="rounded-xl border border-[#dedbd1] bg-white p-4 sm:p-6">
              <div className="mb-4"><h3 className="m-0 text-[23px] font-black leading-tight text-[#24251f]">สถานที่ที่เปิดให้จอง</h3><p className="mb-0 mt-1 text-[19px] text-[#68675f]">{rooms.length} สถานที่</p></div>
              {rooms.length === 0 ? <p className="m-0 rounded-lg border border-dashed border-[#d8d5cc] bg-[#fbfaf7] p-6 text-center text-[19px] text-[#68675f]">ยังไม่มีสถานที่</p> : <div className="space-y-3">{rooms.map((room) => <article key={room.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e5e2d9] bg-[#fbfaf7] p-4"><div className="min-w-[160px] flex-1"><p className="m-0 text-[20px] font-bold text-[#24251f]">{room.name}</p><p className="mb-0 mt-1 break-words text-[19px] text-[#68675f]">#{room.id} · {room.type}{room.capacity ? ` · ${room.capacity} คน` : ''}</p></div><div className="flex gap-2"><button type="button" onClick={() => startEditingRoom(room)} className="min-h-12 rounded-md border border-[#d8d5cc] bg-white px-4 py-2 text-[19px] font-bold text-[#45463f] transition hover:bg-[#f0eee7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a76d34]">แก้ไข</button><button type="button" disabled={busyAction === `room-${room.id}`} onClick={() => deactivateRoom(room)} className="min-h-12 rounded-md border border-red-200 bg-white px-4 py-2 text-[19px] font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">ซ่อน</button></div></article>)}</div>}
            </div>
          </section>
        </>}
      </section>
    </div>
  )
}

export default AdminPanel

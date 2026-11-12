import { useEffect, useState } from 'react'
import { apiRequest } from './api'

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

async function fetchAdminData(token, signal) {
  const [rooms, bookings] = await Promise.all([
    apiRequest('/api/admin/rooms', { token, signal }),
    apiRequest('/api/admin/bookings', { token, signal }),
  ])
  if (!Array.isArray(rooms) || !Array.isArray(bookings)) {
    throw new Error('รูปแบบข้อมูลจาก API ไม่ถูกต้อง')
  }
  return { rooms, bookings }
}

function AdminPanel({ token, onClose, onRoomsChanged }) {
  const [rooms, setRooms] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [roomForm, setRoomForm] = useState(emptyRoom)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomError, setRoomError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyAction, setBusyAction] = useState('')

  async function loadAdminData() {
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchAdminData(token)
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
    fetchAdminData(token, controller.signal)
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
  }, [token])

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
      <section role="dialog" aria-modal="true" aria-labelledby="admin-title" className="max-h-[92vh] w-full max-w-[980px] overflow-y-auto bg-[#f2f0e9] p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between">
          <div><p className="mb-1 text-[8px] font-bold tracking-[.17em] text-[#a76d34]">ADMINISTRATION</p><h2 id="admin-title" className="m-0 text-[20px] font-black">จัดการสนามและรายการจอง</h2></div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center border border-[#d8d5cc] text-[#45463f]" aria-label="ปิดหน้าต่าง">×</button>
        </div>

        {loadError && <div role="alert" className="mb-4 border border-red-300 bg-red-50 p-3 text-[10px] text-red-800">{loadError}<button type="button" onClick={loadAdminData} className="ml-2 font-bold underline">ลองอีกครั้ง</button></div>}
        {actionError && <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-3 text-[10px] text-red-800">{actionError}</p>}
        {loading ? <p role="status" className="py-10 text-center text-[11px] text-[#77766e]">กำลังโหลดข้อมูลผู้ดูแล…</p> : <>
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="m-0 text-[14px] font-black">คำขอจอง</h3><span className="text-[9px] text-[#77766e]">{bookings.length} รายการ</span></div>
            {bookings.length === 0 ? <p className="border border-[#dedbd1] bg-white p-5 text-center text-[10px] text-[#77766e]">ยังไม่มีรายการจอง</p> : <div className="space-y-2">{bookings.map((booking) => {
              const room = rooms.find((item) => item.id === booking.room_id)
              const busy = busyAction === `booking-${booking.id}`
              return <article key={booking.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#dedbd1] bg-white p-3">
                <div><p className="m-0 text-[11px] font-bold">{room?.name || `สถานที่ #${booking.room_id}`} · #{booking.id}</p><p className="mb-0 mt-1 text-[9px] text-[#77766e]">สมาชิก #{booking.user_id} · {booking.booking_date} · {formatTime(booking.start_time)}–{formatTime(booking.end_time)}</p>{booking.note && <p className="mb-0 mt-1 text-[9px] text-[#77766e]">หมายเหตุ: {booking.note}</p>}</div>
                <div className="flex flex-wrap items-center gap-2"><span className="bg-[#f3eee4] px-2 py-1 text-[9px] font-bold text-[#8c5c28]">{formatStatus(booking.status)}</span>
                  {booking.status === 'pending' && <><button type="button" disabled={busy} onClick={() => reviewBooking(booking, 'approved')} className="bg-[#1c1d19] px-3 py-2 text-[9px] font-bold text-white disabled:opacity-50">{busy ? 'กำลังบันทึก…' : 'อนุมัติ'}</button><button type="button" disabled={busy} onClick={() => reviewBooking(booking, 'rejected')} className="border border-[#d8d5cc] px-3 py-2 text-[9px] font-bold text-[#45463f] disabled:opacity-50">ปฏิเสธ</button></>}
                  {['pending', 'approved', 'confirmed'].includes(booking.status) && <button type="button" disabled={busy} onClick={() => cancelBooking(booking)} className="border border-red-200 px-3 py-2 text-[9px] font-bold text-red-700 disabled:opacity-50">ยกเลิก</button>}
                </div>
              </article>
            })}</div>}
          </section>

          <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <h3 className="mb-3 mt-0 text-[14px] font-black">{editingRoom ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่'}</h3>
              <form onSubmit={saveRoom} className="space-y-2.5 border border-[#dedbd1] bg-white p-4">
                <label className="block text-[9px] font-bold text-[#4b4b44]">ชื่อสถานที่<input name="name" value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} required maxLength="200" className="mt-1 block w-full border border-[#d8d5cc] px-3 py-2 text-[10px] font-normal" /></label>
                <label className="block text-[9px] font-bold text-[#4b4b44]">ประเภท<input name="type" value={roomForm.type} onChange={(event) => setRoomForm({ ...roomForm, type: event.target.value })} required maxLength="100" placeholder="เช่น badminton" className="mt-1 block w-full border border-[#d8d5cc] px-3 py-2 text-[10px] font-normal" /></label>
                <label className="block text-[9px] font-bold text-[#4b4b44]">ความจุ<input name="capacity" type="number" min="1" value={roomForm.capacity} onChange={(event) => setRoomForm({ ...roomForm, capacity: event.target.value })} className="mt-1 block w-full border border-[#d8d5cc] px-3 py-2 text-[10px] font-normal" /></label>
                <label className="block text-[9px] font-bold text-[#4b4b44]">รายละเอียด<textarea name="description" rows="2" value={roomForm.description} onChange={(event) => setRoomForm({ ...roomForm, description: event.target.value })} className="mt-1 block w-full border border-[#d8d5cc] px-3 py-2 text-[10px] font-normal" /></label>
                <label className="block text-[9px] font-bold text-[#4b4b44]">URL รูปภาพ<input name="image_url" type="url" value={roomForm.image_url} onChange={(event) => setRoomForm({ ...roomForm, image_url: event.target.value })} className="mt-1 block w-full border border-[#d8d5cc] px-3 py-2 text-[10px] font-normal" /></label>
                {roomError && <p role="alert" className="m-0 border border-red-300 bg-red-50 px-3 py-2 text-[10px] text-red-800">{roomError}</p>}
                <div className="flex gap-2"><button type="submit" disabled={busyAction === 'room'} className="flex-1 bg-[#df8c37] px-3 py-2.5 text-[9px] font-black text-[#1c1d19] disabled:opacity-50">{busyAction === 'room' ? 'กำลังบันทึก…' : editingRoom ? 'บันทึกการแก้ไข' : 'เพิ่มสถานที่'}</button>{editingRoom && <button type="button" onClick={resetRoomForm} className="border border-[#d8d5cc] px-3 py-2.5 text-[9px] font-bold">ยกเลิก</button>}</div>
              </form>
            </div>

            <div>
              <h3 className="mb-3 mt-0 text-[14px] font-black">สถานที่ที่เปิดให้จอง</h3>
              {rooms.length === 0 ? <p className="border border-[#dedbd1] bg-white p-5 text-center text-[10px] text-[#77766e]">ยังไม่มีสถานที่</p> : <div className="space-y-2">{rooms.map((room) => <article key={room.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#dedbd1] bg-white p-3"><div><p className="m-0 text-[11px] font-bold">{room.name}</p><p className="mb-0 mt-1 text-[9px] text-[#77766e]">#{room.id} · {room.type}{room.capacity ? ` · ${room.capacity} คน` : ''}</p></div><div className="flex gap-2"><button type="button" onClick={() => startEditingRoom(room)} className="border border-[#d8d5cc] px-3 py-2 text-[9px] font-bold">แก้ไข</button><button type="button" disabled={busyAction === `room-${room.id}`} onClick={() => deactivateRoom(room)} className="border border-red-200 px-3 py-2 text-[9px] font-bold text-red-700 disabled:opacity-50">ซ่อน</button></div></article>)}</div>}
            </div>
          </section>
        </>}
      </section>
    </div>
  )
}

export default AdminPanel

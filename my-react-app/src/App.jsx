import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from './api'
import AdminPanel from './AdminPanel'
import PasswordChangeDialog from './PasswordChangeDialog'
import {
  createBookingCalendarEvent,
  filterRooms,
  formatBookingDuration,
  getTodayInBangkok,
  hasTimeConflict,
  splitBookings,
} from './bookingUtils'

const iconPaths = {
  arrow: <><path d="M4 12h15" /><path d="m13 5 7 7-7 7" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
}

function Icon({ name, size = 18, className = '' }) {
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>
}

const roomTypeLabels = {
  room: 'ห้องประชุม',
  badminton: 'แบดมินตัน',
  football: 'ฟุตซอล',
  basketball: 'บาสเกตบอล',
}
const roomTypeImages = {
  room: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1100&q=85',
  badminton: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1100&q=85',
  football: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1100&q=85',
  basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1100&q=85',
}
const heroSlides = [
  { title: 'สนามบาสเกตบอล', image: roomTypeImages.basketball.replace('w=1100', 'w=1800'), alt: 'สนามบาสเกตบอลในร่มพร้อมแป้นบาส' },
  { title: 'สนามแบดมินตัน', image: roomTypeImages.badminton.replace('w=1100', 'w=1800'), alt: 'สนามแบดมินตันในร่ม' },
  { title: 'สนามฟุตซอล', image: roomTypeImages.football.replace('w=1100', 'w=1800'), alt: 'สนามฟุตซอลหญ้าเทียม' },
  { title: 'ห้องประชุม', image: roomTypeImages.room.replace('w=1100', 'w=1800'), alt: 'ห้องประชุมพร้อมโต๊ะและเก้าอี้' },
]
const today = getTodayInBangkok()

function displayRoomType(type) {
  return roomTypeLabels[type?.toLowerCase()] || type || 'พื้นที่ให้บริการ'
}

function roomImage(room) {
  return room.image_url || roomTypeImages[room.type?.toLowerCase()] || roomTypeImages.room
}

function formatBookingTime(time) {
  return time?.slice(0, 5) || '--:--'
}

function formatBookingStatus(status) {
  return {
    pending: 'รอยืนยัน',
    approved: 'อนุมัติแล้ว',
    confirmed: 'ยืนยันแล้ว',
    rejected: 'ไม่อนุมัติ',
    cancelled: 'ยกเลิกแล้ว',
  }[status] || status
}

function fetchRooms(signal) {
  return apiRequest('/api/rooms', { signal }).then((result) => {
    if (!Array.isArray(result)) throw new Error('รูปแบบรายการสถานที่จาก API ไม่ถูกต้อง')
    return result
  })
}

function App() {
  const [filter, setFilter] = useState('ทั้งหมด')
  const [search, setSearch] = useState('')
  const [heroSlideIndex, setHeroSlideIndex] = useState(0)
  const [minCapacity, setMinCapacity] = useState('0')
  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomsError, setRoomsError] = useState('')
  const [bookingCourt, setBookingCourt] = useState(null)
  const [bookingComplete, setBookingComplete] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingReview, setBookingReview] = useState(null)
  const [bookingDate, setBookingDate] = useState(today)
  const [availability, setAvailability] = useState([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0)
  const [token, setToken] = useState(() => sessionStorage.getItem('bookingToken') || '')
  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [bookingsOpen, setBookingsOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [bookings, setBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [bookingsError, setBookingsError] = useState('')
  const [notice, setNotice] = useState('')

  const filters = useMemo(() => ['ทั้งหมด', ...new Set(rooms.map((room) => displayRoomType(room.type)))], [rooms])
  const filteredRooms = useMemo(() => filterRooms(rooms, {
    type: filter,
    search,
    minCapacity: Number(minCapacity),
  }), [filter, minCapacity, rooms, search])
  const bookingGroups = useMemo(() => splitBookings(bookings), [bookings])
  const activeHeroSlide = heroSlides[heroSlideIndex]

  async function loadRooms() {
    setRoomsLoading(true)
    setRoomsError('')
    try {
      setRooms(await fetchRooms())
    } catch (error) {
      setRoomsError(error.message)
    } finally {
      setRoomsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchRooms(controller.signal)
      .then(setRooms)
      .catch((error) => {
        if (error.name !== 'AbortError') setRoomsError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRoomsLoading(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    apiRequest('/api/auth/profile', { token, signal: controller.signal })
      .then(setUser)
      .catch((error) => {
        if (error.name === 'AbortError') return
        if (error.status === 401) {
          sessionStorage.removeItem('bookingToken')
          setToken('')
          setUser(null)
          setAuthOpen(true)
          setAuthError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง')
        } else {
          setNotice(`ตรวจสอบบัญชีไม่สำเร็จ: ${error.message}`)
        }
      })
    return () => controller.abort()
  }, [token])

  useEffect(() => {
    if (!bookingCourt || !bookingDate) return
    const controller = new AbortController()
    apiRequest(`/api/rooms/${bookingCourt.id}/availability?date=${encodeURIComponent(bookingDate)}`, { signal: controller.signal })
      .then((result) => {
        if (!Array.isArray(result.occupied)) throw new Error('รูปแบบข้อมูลเวลาว่างจาก API ไม่ถูกต้อง')
        setAvailability(result.occupied)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setAvailabilityError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false)
      })
    return () => controller.abort()
  }, [availabilityRefresh, bookingCourt, bookingDate])

  function startBooking(court) {
    setBookingCourt(court)
    setBookingComplete(false)
    setBookingError('')
    setBookingReview(null)
    setBookingDate(today)
    setAvailability([])
    setAvailabilityLoading(true)
    setAvailabilityError('')
    if (!token) {
      setAuthMode('login')
      setAuthError('เข้าสู่ระบบก่อน แล้วจึงส่งคำขอจองได้')
      setAuthOpen(true)
    }
  }

  function closeBooking() {
    setBookingCourt(null)
    setBookingComplete(false)
    setBookingError('')
    setBookingReview(null)
  }

  function showPreviousHeroSlide() {
    setHeroSlideIndex((index) => (index - 1 + heroSlides.length) % heroSlides.length)
  }

  function showNextHeroSlide() {
    setHeroSlideIndex((index) => (index + 1) % heroSlides.length)
  }

  async function loadBookings(authToken = token) {
    setBookingsLoading(true)
    setBookingsError('')
    try {
      const result = await apiRequest('/api/bookings', { token: authToken })
      setBookings(result)
    } catch (error) {
      setBookingsError(error.message)
      if (error.status === 401) {
        sessionStorage.removeItem('bookingToken')
        setToken('')
        setUser(null)
        setBookingsOpen(false)
        setAuthMode('login')
        setAuthError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง')
        setAuthOpen(true)
      }
    } finally {
      setBookingsLoading(false)
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthSubmitting(true)
    setAuthError('')
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    try {
      if (authMode === 'register') {
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: String(formData.get('name') || '').trim(),
            email,
            password,
          }),
        })
      }
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      sessionStorage.setItem('bookingToken', result.token)
      setToken(result.token)
      setUser(result.user)
      setAuthOpen(false)
      setAuthError('')
      setBookingError('')
      if (bookingsOpen) await loadBookings(result.token)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthSubmitting(false)
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', token })
      sessionStorage.removeItem('bookingToken')
      setToken('')
      setUser(null)
      setBookings([])
      setBookingsOpen(false)
      setNotice('ออกจากระบบแล้ว')
    } catch (error) {
      if (error.status === 401) {
        sessionStorage.removeItem('bookingToken')
        setToken('')
        setUser(null)
        setBookings([])
        setBookingsOpen(false)
        setNotice('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง')
        return
      }
      setNotice(`ออกจากระบบไม่สำเร็จ: ${error.message}`)
    }
  }

  async function handleBookingSubmit(event) {
    event.preventDefault()
    if (!token || !bookingCourt) {
      setAuthOpen(true)
      setAuthMode('login')
      setAuthError('เข้าสู่ระบบก่อน แล้วจึงส่งคำขอจองได้')
      return
    }
    setBookingError('')
    const formData = new FormData(event.currentTarget)
    const startTime = String(formData.get('start_time') || '')
    const endTime = String(formData.get('end_time') || '')
    if (endTime <= startTime) {
      setBookingError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม')
      return
    }
    if (hasTimeConflict(startTime, endTime, availability)) {
      setBookingError('ช่วงเวลานี้มีผู้จองแล้ว กรุณาเลือกเวลาอื่น')
      return
    }
    setBookingReview({
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      note: String(formData.get('note') || '').trim(),
    })
  }

  async function confirmBooking() {
    if (!token || !bookingCourt || !bookingReview) return
    setBookingSubmitting(true)
    setBookingError('')
    try {
      await apiRequest('/api/bookings', {
        method: 'POST',
        token,
        body: JSON.stringify({
          room_id: bookingCourt.id,
          booking_date: bookingReview.booking_date,
          start_time: bookingReview.start_time,
          end_time: bookingReview.end_time,
          note: bookingReview.note,
        }),
      })
      setBookingReview(null)
      setBookingComplete(true)
      if (bookingsOpen) await loadBookings()
    } catch (error) {
      if (error.status === 409) {
        setBookingReview(null)
        setAvailabilityLoading(true)
        setAvailabilityError('')
        setAvailabilityRefresh((version) => version + 1)
        setBookingError('ช่วงเวลานี้เพิ่งมีผู้จอง กรุณาเลือกเวลาอื่น (อัปเดตเวลาที่ถูกจองแล้ว)')
      } else {
        setBookingError(error.message)
      }
      if (error.status === 401) {
        sessionStorage.removeItem('bookingToken')
        setToken('')
        setUser(null)
        setAuthMode('login')
        setAuthError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง')
        setAuthOpen(true)
      }
    } finally {
      setBookingSubmitting(false)
    }
  }

  function downloadBookingCalendar(booking, roomName) {
    const calendar = createBookingCalendarEvent(booking, roomName)
    const file = new Blob([calendar], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `booking-${booking.id}.ics`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function handlePasswordChanged() {
    sessionStorage.removeItem('bookingToken')
    setToken('')
    setUser(null)
    setBookings([])
    setPasswordOpen(false)
    setAuthMode('login')
    setAuthError('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่')
    setAuthOpen(true)
  }

  async function cancelBooking(bookingId) {
    if (!window.confirm('ต้องการยกเลิกการจองนี้หรือไม่?')) return
    try {
      await apiRequest(`/api/bookings/${bookingId}`, { method: 'DELETE', token })
      await loadBookings()
    } catch (error) {
      if (error.status === 401) {
        sessionStorage.removeItem('bookingToken')
        setToken('')
        setUser(null)
        setBookingsOpen(false)
        setAuthMode('login')
        setAuthError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง')
        setAuthOpen(true)
        return
      }
      setBookingsError(`ยกเลิกการจองไม่สำเร็จ: ${error.message}`)
    }
  }

  return (
    <main className="min-h-screen bg-[#f2f0e9] text-[#191a17]">
      <div className="flex min-h-10 items-center justify-center bg-[#1c1d19] px-4 py-2 text-center text-[19px] font-semibold leading-relaxed text-[#f3efe3]">
        ค้นหาสนามและส่งคำขอจองออนไลน์ได้แล้ว <span className="mx-2 text-[#e2a04b]">✳</span> เลือกพื้นที่ที่ใช่ แล้วชวนทีมมาเล่นกัน
        <a href="#courts" className="ml-2 hidden text-[#e9aa5a] underline underline-offset-2 sm:inline">เลือกสนามเลย</a>
      </div>

      <header className="sticky top-0 z-30 border-b border-black/[.07] bg-[#f2f0e9]/95 backdrop-blur-md">
        <nav className="mx-auto flex min-h-[68px] max-w-[1440px] flex-wrap items-center justify-between gap-y-2 px-5 py-2 sm:h-[68px] sm:flex-nowrap sm:py-0 sm:px-8 lg:px-12" aria-label="เมนูหลัก">
          <a href="#home" className="flex items-center gap-2.5 text-[#1b1c18] no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#df8c37] text-[20px] font-black text-[#191a17]">S.</span>
            <span className="text-[19px] font-black tracking-[.12em]">SANAM<span className="font-normal">DEE</span><span className="ml-1.5 block text-[19px] font-medium tracking-[.2em] text-[#85837b]">SPORTS CLUB · BANGKOK</span></span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#courts" className="text-[19px] font-semibold text-[#494a43] no-underline transition hover:text-[#bd7028]">สนามของเรา</a>
            <a href="#experience" className="text-[19px] font-semibold text-[#494a43] no-underline transition hover:text-[#bd7028]">ประสบการณ์</a>
            <a href="#visit" className="text-[19px] font-semibold text-[#494a43] no-underline transition hover:text-[#bd7028]">สถานที่</a>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {user?.role === 'admin' && <button type="button" onClick={() => setAdminOpen(true)} className="min-h-11 rounded-md border border-[#d6d2c8] bg-white/70 px-3 text-[19px] font-bold text-[#3d3d36] transition hover:border-[#bc782f] hover:bg-white">จัดการระบบ</button>}
            {user && <button type="button" onClick={() => { setBookingsOpen(true); loadBookings() }} className="min-h-11 rounded-md border border-[#d6d2c8] bg-white/70 px-3 text-[19px] font-bold text-[#3d3d36] transition hover:border-[#bc782f] hover:bg-white">การจอง</button>}
            {user && <button type="button" onClick={() => setPasswordOpen(true)} className="min-h-11 rounded-md border border-[#d6d2c8] bg-white/70 px-3 text-[19px] font-bold text-[#3d3d36] transition hover:border-[#bc782f] hover:bg-white">รหัสผ่าน</button>}
            <button type="button" onClick={() => { if (user) handleLogout(); else { setAuthMode('login'); setAuthError(''); setAuthOpen(true) } }} className="min-h-11 rounded-md border border-[#d6d2c8] bg-white/70 px-3 text-[19px] font-bold text-[#3d3d36] transition hover:border-[#bc782f] hover:bg-white">{user ? 'ออกจากระบบ' : 'เข้าสู่ระบบ'}</button>
            <a href="#courts" className="group flex min-h-11 items-center gap-2 rounded-md bg-[#df8c37] px-4 text-[19px] font-bold text-[#201e19] no-underline transition hover:bg-[#efa957] sm:px-5">จองสนาม <Icon name="arrow" size={19} className="transition group-hover:translate-x-1" /></a>
          </div>
        </nav>
      </header>

      {notice && <div role="status" className="mx-auto flex max-w-[1344px] items-center justify-between gap-3 bg-[#fff4df] px-5 py-2 text-[19px] text-[#724d23] sm:mx-8 lg:mx-12"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="text-[19px]" aria-label="ปิดข้อความ">×</button></div>}

      <section id="home" className="mx-auto grid max-w-[1440px] gap-8 px-5 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-12 lg:px-12 lg:py-12">
        <div className="flex flex-col justify-center lg:py-8">
          <p className="mb-4 flex items-center gap-2 text-[19px] font-bold text-[#925c2b]"><span className="h-px w-7 bg-[#c3813e]" />พื้นที่ของคนรักกีฬา · กรุงเทพฯ</p>
          <h1 className="m-0 max-w-[620px] text-[clamp(3.35rem,8vw,6.4rem)] font-black uppercase leading-[.82] tracking-[-.075em] text-[#1c1d19]">MAKE<br />YOUR<br /><span className="text-[#d48235]">MOVE.</span></h1>
          <p className="mb-0 mt-6 max-w-[380px] text-[19px] leading-[1.9] text-[#65645d] sm:text-[19px]">สนามดี ๆ เปลี่ยนวันธรรมดาให้เป็นเกมที่น่าจดจำ เลือกพื้นที่ที่ใช่ ส่งคำขอจอง แล้วชวนทีมมาเล่นกัน</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a href="#courts" className="group flex items-center gap-3 bg-[#1c1d19] px-5 py-3.5 text-[19px] font-bold text-white no-underline transition hover:bg-[#36362f]">ค้นหาสนาม <Icon name="arrow" size={19} className="text-[#e7a14f] transition group-hover:translate-x-1" /></a>
            <a href="#experience" className="text-[19px] font-semibold text-[#4c4a43] no-underline transition hover:text-[#bf762f]">รู้จักสนามดี <span className="ml-1">↘</span></a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4 border-t border-[#d9d6cc] pt-5 sm:mt-10 sm:gap-x-8">
            <div><p className="m-0 text-[25px] font-black tracking-tight">{roomsLoading ? '…' : rooms.length}</p><p className="mt-0.5 text-[19px] font-semibold text-[#85837b]">พื้นที่พร้อมจอง</p></div>
            <span className="h-8 w-px bg-[#d8d5cc]" />
            <div><p className="m-0 text-[25px] font-black tracking-tight">{filters.length - 1}</p><p className="mt-0.5 text-[19px] font-semibold text-[#85837b]">ประเภทพื้นที่</p></div>
            <span className="h-8 w-px bg-[#d8d5cc]" />
            <div><p className="m-0 text-[25px] font-black tracking-tight">24<span className="ml-1 text-[19px] text-[#d98a39]">h</span></p><p className="mt-0.5 text-[19px] font-semibold text-[#85837b]">จองออนไลน์</p></div>
          </div>
        </div>

        <div className="relative min-h-[300px] overflow-hidden rounded-xl bg-[#393b34] shadow-lg sm:min-h-[440px] lg:min-h-[550px]">
          <img key={activeHeroSlide.image} src={activeHeroSlide.image} alt={activeHeroSlide.alt} className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/5" />
          <div className="absolute left-5 top-5 flex items-center gap-2 border border-white/40 bg-black/20 px-3 py-2 text-[19px] font-semibold tracking-[.14em] text-white backdrop-blur-sm sm:left-7 sm:top-7"><span className="h-1.5 w-1.5 rounded-full bg-[#efad5d]" /> CHECK VENUES & BOOK ONLINE</div>
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white sm:bottom-8 sm:left-8 sm:right-8">
            <div><p className="mb-2 text-[19px] font-bold text-[#edb36f]">{activeHeroSlide.title}</p><p className="m-0 text-[24px] font-black leading-tight sm:text-[36px]">เกมของคุณ<br />เริ่มตรงนี้</p></div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={showPreviousHeroSlide} aria-label="ภาพก่อนหน้า" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 text-white transition hover:border-[#e7a14f] hover:bg-[#e7a14f] hover:text-black sm:h-12 sm:w-12"><Icon name="arrow" size={19} className="rotate-180" /></button>
              <button type="button" onClick={showNextHeroSlide} aria-label="ภาพถัดไป" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 text-white transition hover:border-[#e7a14f] hover:bg-[#e7a14f] hover:text-black sm:h-12 sm:w-12"><Icon name="arrow" size={19} /></button>
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 pb-4 sm:pb-5" aria-label="เลือกรูปสนาม">
            {heroSlides.map((slide, index) => <button key={slide.title} type="button" onClick={() => setHeroSlideIndex(index)} aria-label={`แสดงภาพที่ ${index + 1}: ${slide.title}`} aria-current={index === heroSlideIndex ? 'true' : undefined} className={`h-3 rounded-full transition-all ${index === heroSlideIndex ? 'w-8 bg-[#df8c37]' : 'w-3 bg-white/70 hover:bg-white'}`} />)}
          </div>
          <div className="absolute bottom-0 right-0 bg-[#df8c37] px-4 py-3 text-[19px] font-bold tracking-[.12em] text-[#1b1b17] sm:px-5" aria-live="polite"><span className="text-[19px]">{String(heroSlideIndex + 1).padStart(2, '0')}</span> / {String(heroSlides.length).padStart(2, '0')}</div>
        </div>
      </section>

      <div className="overflow-hidden bg-[#df8c37] py-3.5 text-[#22221c]" aria-label="พื้นที่สำหรับทุกเกม">
        <div className="flex min-w-max animate-[marquee_28s_linear_infinite] items-center gap-7 whitespace-nowrap text-[19px] font-black tracking-[.18em] sm:gap-10 sm:text-[19px]">
          {[0, 1, 2, 3].map((item) => <span key={item} className="flex items-center gap-7 sm:gap-10">PLAY YOUR GAME <span className="text-[21px] font-normal">✳</span> BOOK YOUR COURT <span className="text-[21px] font-normal">✳</span> BRING YOUR PEOPLE <span className="text-[21px] font-normal">✳</span></span>)}
        </div>
      </div>

      <section id="experience" className="mx-auto grid max-w-[1440px] gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[.8fr_1.2fr] lg:gap-14 lg:px-12 lg:py-24">
        <div className="relative min-h-[260px] overflow-hidden rounded-xl bg-[#b4ad9c] shadow-md sm:min-h-[360px]">
          <img src="https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1000&q=85" alt="ผู้เล่นกำลังฝึกซ้อมในสนามกีฬา" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute bottom-5 left-5 text-white"><p className="mb-1 text-[19px] font-bold tracking-[.17em] text-[#f0b269]">GOOD GAME, GOOD PEOPLE</p><p className="m-0 text-[21px] font-bold">พื้นที่ที่ชวนให้กลับมาเล่นอีก</p></div>
          <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#df8c37] text-[19px] font-black leading-tight text-center text-[#1c1d19]">PLAY<br />MORE</div>
        </div>
        <div className="flex flex-col justify-center py-2 lg:py-6">
          <p className="mb-3 text-[19px] font-bold text-[#925c2b]">มากกว่าแค่พื้นที่เล่นกีฬา</p>
          <h2 className="m-0 max-w-[570px] text-[32px] font-black leading-tight sm:text-[48px]">พื้นที่ดี ๆ<br />ทำให้ทุกเกม<br /><span className="text-[#d48235]">มีความหมาย.</span></h2>
          <p className="mb-0 mt-4 max-w-[490px] text-[19px] leading-[1.9] text-[#68675f] sm:text-[19px]">เราคัดสรรสนามที่ได้มาตรฐาน ดูแลทุกพื้นที่ให้พร้อมเล่น และทำให้การจองเป็นเรื่องง่าย เพื่อให้คุณใช้เวลาไปกับเกมและคนสำคัญได้เต็มที่</p>
          <div className="mt-6 grid max-w-[500px] grid-cols-1 gap-3 border-t border-[#d9d6cc] pt-5 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
            {[['01', 'จองง่ายในไม่กี่ขั้นตอน'], ['02', 'ดูข้อมูลสถานที่ก่อนจอง'], ['03', 'ส่งคำขอผ่านระบบออนไลน์'], ['04', 'ตรวจสอบสถานะการจองได้']].map(([number, text]) => <div key={number} className="flex items-start gap-2.5"><span className="text-[19px] font-bold text-[#c47a34]">{number}</span><span className="text-[19px] font-semibold text-[#484941]">{text}</span></div>)}
          </div>
        </div>
      </section>

      <section id="courts" className="bg-[#1c1d19] px-5 py-12 text-[#f4f0e5] sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-[1344px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9">
            <div><p className="mb-2 text-[19px] font-bold tracking-[.18em] text-[#dfa052]">FIND YOUR PLAYING FIELD</p><h2 className="m-0 text-[31px] font-black leading-tight sm:text-[43px]">เลือกสนาม.<br className="sm:hidden" /> แล้วลงเล่น.</h2><p className="mb-0 mt-2 text-[19px] text-[#aaa99f]">เลือกพื้นที่ที่ใช่ แล้วส่งคำขอจองได้ทันที</p></div>
            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <label className="flex min-h-12 min-w-[170px] flex-1 items-center gap-2 rounded-md border border-white/25 bg-white/[.04] px-3 text-[#d2d0c6] transition focus-within:border-[#df8c37] sm:flex-none"><Icon name="search" size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาสนาม..." aria-label="ค้นหาสนาม" className="w-full bg-transparent text-[19px] text-white outline-none placeholder:text-[#aaa99f] sm:w-[160px]" /></label>
              <label className="flex min-h-12 items-center gap-2 rounded-md border border-white/25 bg-white/[.04] px-3 text-[19px] text-[#f0eee7]">จำนวนผู้เล่น
                <select value={minCapacity} onChange={(event) => setMinCapacity(event.target.value)} aria-label="จำนวนผู้เล่นขั้นต่ำ" className="rounded bg-[#1c1d19] py-1 text-[19px] text-white outline-none">
                  <option value="0">ทั้งหมด</option><option value="2">2+</option><option value="4">4+</option><option value="10">10+</option>
                </select>
              </label>
              </div>
              <div className="hide-scrollbar flex max-w-full gap-2 overflow-x-auto sm:max-w-[460px]">
                {filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-11 shrink-0 rounded-full border px-4 text-[19px] font-semibold transition ${filter === item ? 'border-[#df8c37] bg-[#df8c37] text-[#1c1d19]' : 'border-white/25 text-[#e2e0d7] hover:border-white/60 hover:bg-white/5'}`}>{item}</button>)}
              </div>
            </div>
          </div>

          {roomsLoading ? <div role="status" className="border border-white/15 py-14 text-center text-[19px] text-[#c8c6bc]">กำลังโหลดรายการสถานที่…</div> : roomsError ? <div role="alert" className="border border-red-200/30 bg-red-950/20 py-10 text-center"><p className="text-[19px] font-semibold">โหลดรายการสถานที่ไม่สำเร็จ</p><p className="mt-1 text-[19px] text-[#c8c6bc]">{roomsError}</p><button type="button" onClick={loadRooms} className="mt-3 border border-[#df8c37] px-4 py-2 text-[19px] font-bold text-[#edb16b]">ลองอีกครั้ง</button>          </div> : filteredRooms.length > 0 ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {filteredRooms.map((room) => <article key={room.id} className="group overflow-hidden rounded-xl border border-white/10 bg-[#282923] shadow-md transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl">
              <div className="relative h-[200px] overflow-hidden sm:h-[220px]"><img src={roomImage(room)} alt={room.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" /><span className="absolute left-3 top-3 rounded-full border border-white/50 bg-black/40 px-3 py-1.5 text-[19px] font-bold text-white backdrop-blur-sm">{displayRoomType(room.type)}</span><span className="absolute bottom-3 left-3 text-[19px] font-semibold text-white">{room.capacity ? `รองรับ ${room.capacity} คน` : 'สอบถามจำนวนผู้ใช้บริการ'}</span></div>
              <div className="flex min-h-[260px] flex-col p-5"><p className="m-0 text-[19px] font-semibold text-[#e8aa61]">สถานที่ #{room.id}</p><h3 className="mb-1.5 mt-1 text-[23px] font-bold leading-snug text-[#f5f1e7]">{room.name}</h3><p className="mb-5 flex-1 text-[19px] leading-relaxed text-[#c2c0b7]">{room.description || 'ติดต่อสอบถามรายละเอียดเพิ่มเติมเกี่ยวกับสถานที่นี้'}</p><div className="flex items-center justify-between gap-3 border-t border-white/15 pt-4"><p className="m-0"><span className="block text-[19px] text-[#b8b6ad]">ราคา</span><b className="text-[19px] text-[#f4f0e5]">สอบถาม</b></p><button type="button" onClick={() => startBooking(room)} className="group/button flex min-h-12 items-center gap-2 rounded-md bg-[#df8c37] px-4 text-[19px] font-bold text-[#1c1d19] transition hover:bg-[#f1ad60]">จองสนาม <Icon name="arrow" size={19} className="transition group-hover/button:translate-x-1" /></button></div></div>
            </article>)}
          </div> : <div className="border border-dashed border-white/20 py-14 text-center"><p className="text-[19px] font-semibold">{rooms.length ? 'ไม่พบสถานที่ที่ตรงกับการค้นหา' : 'ขณะนี้ยังไม่มีสถานที่เปิดให้จอง'}</p>{rooms.length > 0 && <button type="button" onClick={() => { setSearch(''); setFilter('ทั้งหมด'); setMinCapacity('0') }} className="mt-2 text-[19px] text-[#e3a456] underline underline-offset-4">ล้างตัวกรอง</button>}</div>}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5"><p className="m-0 text-[19px] text-[#aaa99f]">เลือกพื้นที่ที่เหมาะกับทีมของคุณ <a href="#courts" className="ml-1 font-semibold text-[#e2a557] no-underline">ดูรายการสนาม ↗</a></p><p className="m-0 text-[19px] tracking-[.13em] text-[#8e8d85]">ALL COURTS · YOUR GAME</p></div>
        </div>
      </section>

      <section id="booking-guide" className="mx-auto grid max-w-[1440px] gap-7 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-16 lg:px-12 lg:py-20">
        <div>
          <p className="mb-2 text-[19px] font-bold tracking-[.14em] text-[#925c2b]">HOW TO BOOK</p>
          <h2 className="m-0 text-[30px] font-black leading-tight sm:text-[42px]">วิธีจองสนาม<br />ทีละขั้นตอน</h2>
          <p className="mb-0 mt-4 max-w-[430px] text-[19px] leading-relaxed text-[#68675f]">เลือกสนามและช่วงเวลาที่ต้องการ ระบบจะแสดงเวลาที่มีผู้จองแล้วก่อนส่งคำขอ</p>
          <a href="#courts" className="mt-5 inline-flex items-center gap-3 bg-[#1c1d19] px-5 py-3.5 text-[19px] font-bold text-white no-underline transition hover:bg-[#36362f]">เลือกสนามเพื่อเริ่มจอง <Icon name="arrow" size={19} className="text-[#e7a14f]" /></a>
        </div>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {[
            ['01', 'เลือกสนาม', 'ดูประเภทสนาม รายละเอียด และจำนวนผู้เล่นที่รองรับ แล้วกด “จองสนาม”'],
            ['02', 'เข้าสู่ระบบ', 'เข้าสู่ระบบหรือสมัครสมาชิกก่อนส่งคำขอ เลือกสนามไว้ก่อนได้ ระบบจะพากลับมาจองต่อหลังล็อกอิน'],
            ['03', 'เลือกวันและเวลา', 'เลือกวันที่ ตรวจช่วงเวลาที่มีผู้จองแล้ว จากนั้นระบุเวลาเริ่มและเวลาสิ้นสุด'],
            ['04', 'ตรวจสอบและยืนยัน', 'ตรวจชื่อสนาม วัน เวลา และระยะเวลาให้ถูกต้อง แล้วกดยืนยันเพื่อส่งคำขอ ระบบจะตรวจเวลาซ้ำอีกครั้ง'],
            ['05', 'ติดตามผลการจอง', 'คำขอใหม่จะเป็นสถานะ “รอยืนยัน” ตรวจสอบผลได้ที่ “การจอง” และเพิ่มรายการลงปฏิทินได้'],
          ].map(([number, title, detail]) => <li key={number} className="flex gap-4 rounded-lg border border-[#e4e0d5] bg-white p-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0dc] text-[19px] font-bold text-[#8a5528]">{number}</span>
            <div><h3 className="m-0 text-[20px] font-bold text-[#24251f]">{title}</h3><p className="mb-0 mt-1 text-[19px] leading-relaxed text-[#595950]">{detail}</p></div>
          </li>)}
        </ol>
      </section>

      <section id="visit" className="relative mx-5 mb-9 overflow-hidden bg-[#df8c37] sm:mx-8 lg:mx-12">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border border-black/10 sm:h-80 sm:w-80" />
        <div className="absolute -right-2 -top-12 h-52 w-52 rounded-full border border-black/10 sm:h-64 sm:w-64" />
        <div className="relative flex flex-col justify-between gap-5 px-5 py-7 sm:flex-row sm:items-end sm:px-8 sm:py-9 lg:px-12 lg:py-11">
          <div><p className="mb-2 text-[19px] font-bold tracking-[.14em] text-[#563718]">READY WHEN YOU ARE</p><h2 className="m-0 text-[27px] font-black leading-tight sm:text-[42px]">นัดทีมให้พร้อม<br />ที่เหลือเราจัดให้</h2><p className="mb-0 mt-3 max-w-[450px] text-[19px] leading-relaxed text-[#4f3923]">สนามพร้อม ทีมงานพร้อม เหลือแค่คุณกับเพื่อน ๆ แล้วมาเจอกัน</p></div>
          <a href="#courts" className="group flex w-fit items-center gap-4 bg-[#1c1d19] px-5 py-3.5 text-[19px] font-bold text-white no-underline transition hover:bg-[#393a33]">จองสนามของคุณ <Icon name="arrow" size={19} className="text-[#e7a14f] transition group-hover:translate-x-1" /></a>
        </div>
      </section>

      <footer className="bg-[#1c1d19] px-5 py-8 text-[#f2f0e9] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1344px] flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><a href="#home" className="text-[19px] font-black tracking-[.14em] text-white no-underline">SANAM<span className="font-normal">DEE</span></a><p className="mb-0 mt-2 text-[19px] text-[#a4a39b]">พื้นที่ดี ๆ สำหรับทุกเกมของคุณ · กรุงเทพฯ</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[19px] text-[#c3c1b8]"><a href="#courts" className="text-inherit no-underline hover:text-[#e3a456]">สนามของเรา</a><a href="#experience" className="text-inherit no-underline hover:text-[#e3a456]">เกี่ยวกับสนามดี</a><a href="#booking-guide" className="text-inherit no-underline hover:text-[#e3a456]">วิธีจอง</a></div>
          <p className="m-0 text-[19px] text-[#85847c]">© 2026 SANAMDEE SPORTS CLUB</p>
        </div>
      </footer>

      {bookingCourt && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeBooking() }}>
        <section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="h-[94dvh] max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl bg-[#f5f4ef] p-5 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-[520px] sm:rounded-2xl sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#dedbd1] pb-4"><div><p className="mb-1 text-[19px] font-bold text-[#925c2b]">BOOK YOUR COURT · #{bookingCourt.id}</p><h2 id="booking-title" className="m-0 text-[25px] font-black leading-snug text-[#24251f]">{bookingComplete ? 'ส่งคำขอจองแล้ว' : bookingCourt.name}</h2></div><button type="button" onClick={closeBooking} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8d5cc] bg-white text-[#45463f] transition hover:bg-[#ebe9e1]" aria-label="ปิดหน้าต่าง"><Icon name="close" size={19} /></button></div>
          {bookingComplete ? <div className="rounded-xl border border-[#e4e0d5] bg-white px-5 py-8 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f0e9] text-[#315d40]"><Icon name="check" size={26} /></div><p className="m-0 text-[20px] font-bold text-[#24251f]">ส่งคำขอจองเรียบร้อย</p><p className="mb-0 mt-2 text-[19px] leading-relaxed text-[#595950]">สถานะเริ่มต้นคือ “รอยืนยัน”<br />ตรวจสอบความคืบหน้าได้ที่รายการจองของฉัน</p><button type="button" onClick={closeBooking} className="mt-6 min-h-12 rounded-md bg-[#1c1d19] px-7 py-3 text-[19px] font-bold text-white transition hover:bg-[#36362f]">เรียบร้อย</button></div> : bookingReview ? <div className="space-y-4">
            <p className="m-0 text-[21px] font-bold text-[#24251f]">ตรวจสอบข้อมูลก่อนส่งคำขอ</p>
            <dl className="space-y-3 rounded-lg border border-[#e4e0d5] bg-white p-4 text-[19px]"><div className="flex justify-between gap-4"><dt className="shrink-0 text-[#68675f]">สนาม</dt><dd className="m-0 text-right font-bold text-[#24251f]">{bookingCourt.name}</dd></div><div className="flex justify-between gap-4"><dt className="shrink-0 text-[#68675f]">วันที่</dt><dd className="m-0 text-right font-bold text-[#24251f]">{bookingReview.booking_date}</dd></div><div className="flex justify-between gap-4"><dt className="shrink-0 text-[#68675f]">เวลา</dt><dd className="m-0 text-right font-bold text-[#24251f]">{formatBookingTime(bookingReview.start_time)}–{formatBookingTime(bookingReview.end_time)}</dd></div><div className="flex justify-between gap-4"><dt className="shrink-0 text-[#68675f]">ระยะเวลา</dt><dd className="m-0 text-right font-bold text-[#24251f]">{formatBookingDuration(bookingReview.start_time, bookingReview.end_time)}</dd></div>{bookingReview.note && <div className="flex justify-between gap-4"><dt className="shrink-0 text-[#68675f]">หมายเหตุ</dt><dd className="m-0 break-words text-right text-[#24251f]">{bookingReview.note}</dd></div>}</dl>
            {bookingError && <p role="alert" className="m-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[19px] leading-relaxed text-red-800">{bookingError}</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" onClick={() => setBookingReview(null)} className="min-h-12 rounded-md border border-[#d8d5cc] bg-white py-3 text-[19px] font-bold text-[#45463f] transition hover:bg-[#f0eee7]">กลับไปแก้ไข</button><button type="button" onClick={confirmBooking} disabled={bookingSubmitting} className="min-h-12 rounded-md bg-[#df8c37] py-3 text-[19px] font-black text-[#1c1d19] transition hover:bg-[#e8a052] disabled:opacity-50">{bookingSubmitting ? 'กำลังส่ง…' : 'ยืนยันการจอง'}</button></div>
          </div> : <><img src={roomImage(bookingCourt)} alt="" className="mb-4 h-[160px] w-full rounded-lg object-cover" /><p className="mb-4 text-[19px] leading-relaxed text-[#595950]">{bookingCourt.description || 'ติดต่อสอบถามรายละเอียดเพิ่มเติมเกี่ยวกับสถานที่นี้'}</p><div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4e0d5] bg-white px-4 py-3"><span className="text-[19px] text-[#68675f]">ประเภท / รองรับ</span><b className="text-[19px] text-[#24251f]">{displayRoomType(bookingCourt.type)} · {bookingCourt.capacity ? `${bookingCourt.capacity} คน` : 'ไม่ระบุ'}</b></div>
            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <label className="block text-[19px] font-bold text-[#3d3d36]">วันที่ต้องการจอง<input name="booking_date" type="date" required min={today} value={bookingDate} onChange={(event) => { setBookingDate(event.target.value); setBookingError(''); setAvailabilityLoading(true); setAvailabilityError(''); setAvailability([]) }} className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f] outline-none focus:border-[#a76d34]" /></label>
              <div className="rounded-lg border border-[#dedbd1] bg-white p-4">
                <div className="flex items-center justify-between gap-2"><p className="m-0 text-[19px] font-bold">เวลาที่มีผู้จองแล้ว</p>{availabilityLoading && <span role="status" className="text-[19px] text-[#77766e]">กำลังตรวจสอบ…</span>}</div>
                {availabilityError ? <p role="alert" className="mb-0 mt-2 text-[19px] leading-relaxed text-red-700">{availabilityError}<button type="button" onClick={() => { setAvailabilityLoading(true); setAvailabilityError(''); setAvailabilityRefresh((version) => version + 1) }} className="ml-2 font-bold underline">ลองใหม่</button></p> : availability.length ? <div className="mt-3 flex flex-wrap gap-2">{availability.map((period) => <span key={`${period.start_time}-${period.end_time}`} className="rounded-md bg-red-50 px-3 py-1.5 text-[19px] font-semibold text-red-700">{formatBookingTime(period.start_time)}–{formatBookingTime(period.end_time)}</span>)}</div> : !availabilityLoading && <p className="mb-0 mt-2 text-[19px] leading-relaxed text-[#68675f]">ยังไม่มีช่วงเวลาที่ถูกจองในวันที่เลือก</p>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block text-[19px] font-bold text-[#3d3d36]">เวลาเริ่ม<input name="start_time" type="time" required step="1800" className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f] outline-none focus:border-[#a76d34]" /></label><label className="block text-[19px] font-bold text-[#3d3d36]">เวลาสิ้นสุด<input name="end_time" type="time" required step="1800" className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f] outline-none focus:border-[#a76d34]" /></label></div>
              <label className="block text-[19px] font-bold text-[#3d3d36]">หมายเหตุ (ไม่บังคับ)<textarea name="note" maxLength="500" rows="2" placeholder="เช่น จำนวนผู้เล่น หรือรายละเอียดเพิ่มเติม" className="mt-1.5 w-full resize-y rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f] outline-none placeholder:text-[#77766e] focus:border-[#a76d34]" /></label>
              {bookingError && <p role="alert" className="m-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[19px] leading-relaxed text-red-800">{bookingError}</p>}
              <button type="submit" disabled={availabilityLoading} className="sticky bottom-0 mt-2 min-h-12 w-full rounded-md bg-[#df8c37] py-3 text-[19px] font-black text-[#1c1d19] transition hover:bg-[#eda553] disabled:cursor-wait disabled:opacity-60">ตรวจสอบและไปหน้ายืนยัน <span className="ml-1">→</span></button>
              <p className="m-0 pb-2 text-center text-[19px] leading-relaxed text-[#68675f]">เวลาว่างอาจเปลี่ยนแปลงได้ ระบบจะตรวจซ้ำก่อนบันทึก</p>
            </form>
          </>}
        </section>
      </div>}

      {adminOpen && user?.role === 'admin' && <AdminPanel token={token} onClose={() => setAdminOpen(false)} onRoomsChanged={loadRooms} />}

      {passwordOpen && user && <PasswordChangeDialog token={token} onClose={() => setPasswordOpen(false)} onChanged={handlePasswordChanged} />}

      {authOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="w-full max-w-[460px] rounded-t-2xl bg-[#f5f4ef] p-5 shadow-2xl sm:rounded-2xl sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#dedbd1] pb-4"><div><p className="mb-1 text-[19px] font-bold text-[#925c2b]">SANAMDEE MEMBERS</p><h2 id="auth-title" className="m-0 text-[27px] font-black text-[#24251f]">{authMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h2><p className="mb-0 mt-1 text-[19px] leading-relaxed text-[#68675f]">เข้าสู่ระบบเพื่อส่งคำขอและติดตามสถานะการจอง</p></div><button type="button" onClick={() => setAuthOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8d5cc] bg-white text-[#45463f] transition hover:bg-[#ebe9e1]" aria-label="ปิดหน้าต่าง"><Icon name="close" size={19} /></button></div>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && <label className="block text-[19px] font-bold text-[#3d3d36]">ชื่อที่แสดง<input name="name" required maxLength="200" autoComplete="name" className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f] outline-none focus:border-[#a76d34]" /></label>}
            <label className="block text-[19px] font-bold text-[#3d3d36]">อีเมล<input name="email" type="email" required maxLength="254" autoComplete="email" className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f] outline-none focus:border-[#a76d34]" /></label>
            <label className="block text-[19px] font-bold text-[#3d3d36]">รหัสผ่าน<input name="password" type="password" required minLength="8" maxLength="128" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f] outline-none focus:border-[#a76d34]" /><span className="mt-1 block font-normal leading-relaxed text-[#68675f]">อย่างน้อย 8 ตัวอักษร</span></label>
            {authError && <p role="alert" className="m-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[19px] leading-relaxed text-red-800">{authError}</p>}
            <button type="submit" disabled={authSubmitting} className="min-h-12 w-full rounded-md bg-[#df8c37] py-3 text-[19px] font-black text-[#1c1d19] transition hover:bg-[#eda553] disabled:cursor-wait disabled:opacity-60">{authSubmitting ? 'กำลังดำเนินการ…' : authMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครและเข้าสู่ระบบ'}</button>
          </form>
          <p className="mb-0 mt-5 text-center text-[19px] text-[#68675f]">{authMode === 'login' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?'} <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }} className="font-bold text-[#8a5528] underline underline-offset-2">{authMode === 'login' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</button></p>
        </section>
      </div>}

      {bookingsOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setBookingsOpen(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="my-bookings-title" className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-t-2xl bg-[#f5f4ef] p-5 shadow-2xl sm:rounded-2xl sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#dedbd1] pb-4"><div><p className="mb-1 text-[19px] font-bold text-[#925c2b]">YOUR RESERVATIONS</p><h2 id="my-bookings-title" className="m-0 text-[27px] font-black text-[#24251f]">การจองของฉัน</h2><p className="mb-0 mt-1 text-[19px] text-[#68675f]">ตรวจสอบสถานะหรือเพิ่มรายการลงปฏิทิน</p></div><button type="button" onClick={() => setBookingsOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8d5cc] bg-white text-[#45463f] transition hover:bg-[#ebe9e1]" aria-label="ปิดหน้าต่าง"><Icon name="close" size={19} /></button></div>
          {bookingsLoading ? <p role="status" className="rounded-lg border border-[#e4e0d5] bg-white py-10 text-center text-[19px] text-[#68675f]">กำลังโหลดรายการจอง…</p> : bookingsError ? <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-[19px] leading-relaxed text-red-800">{bookingsError}<button type="button" onClick={() => loadBookings()} className="ml-2 font-bold underline">ลองอีกครั้ง</button></div> : bookings.length === 0 ? <p className="rounded-lg border border-dashed border-[#d8d5cc] bg-white py-10 text-center text-[19px] text-[#68675f]">ยังไม่มีรายการจอง</p> : <div className="space-y-6">{[
            { title: 'รออนุมัติ', items: bookingGroups.pending },
            { title: 'กำลังจะถึง', items: bookingGroups.upcoming },
            { title: 'ประวัติการจอง', items: bookingGroups.history },
          ].map(({ title, items }) => <section key={title}>
            <h3 className="mb-3 mt-0 text-[22px] font-black text-[#24251f]">{title} <span className="font-normal text-[#68675f]">({items.length})</span></h3>
            {items.length === 0 ? <p className="rounded-lg border border-dashed border-[#d8d5cc] bg-white p-4 text-center text-[19px] text-[#68675f]">ไม่มีรายการ</p> : <div className="space-y-3">{items.map((booking) => {
              const room = rooms.find((item) => item.id === booking.room_id)
              const canCancel = ['pending', 'approved', 'confirmed'].includes(booking.status)
              return <article key={booking.id} className="rounded-lg border border-[#e4e0d5] bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-[220px] flex-1"><p className="m-0 text-[20px] font-bold text-[#24251f]">{room?.name || `สถานที่ #${booking.room_id}`}</p><p className="mb-0 mt-1 text-[19px] leading-relaxed text-[#595950]">{booking.booking_date} · {formatBookingTime(booking.start_time)}–{formatBookingTime(booking.end_time)}</p>{booking.note && <p className="mb-0 mt-1 break-words text-[19px] text-[#68675f]">หมายเหตุ: {booking.note}</p>}</div><span className={`rounded-full px-3 py-1 text-[19px] font-bold ${booking.status === 'pending' ? 'bg-[#fff0dc] text-[#8a4b0d]' : ['rejected', 'cancelled'].includes(booking.status) ? 'bg-[#f3e8e6] text-[#8b3b32]' : 'bg-[#e7f0e9] text-[#315d40]'}`}>{formatBookingStatus(booking.status)}</span></div>
                <div className="mt-4 flex flex-wrap gap-2">{canCancel && <button type="button" onClick={() => cancelBooking(booking.id)} className="min-h-11 rounded-md border border-[#d8d5cc] px-4 py-2 text-[19px] font-semibold text-[#5b554b] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700">ยกเลิกการจอง</button>}{!['rejected', 'cancelled'].includes(booking.status) && <button type="button" onClick={() => downloadBookingCalendar(booking, room?.name || `สถานที่ #${booking.room_id}`)} className="min-h-11 rounded-md border border-[#d8d5cc] px-4 py-2 text-[19px] font-semibold text-[#5b554b] transition hover:border-[#bc782f] hover:bg-[#faf4eb]">เพิ่มในปฏิทิน</button>}</div>
              </article>
            })}</div>}
          </section>)}</div>}
        </section>
      </div>}
    </main>
  )
}

export default App

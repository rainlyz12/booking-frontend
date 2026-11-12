import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from './api'

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
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

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
  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomsError, setRoomsError] = useState('')
  const [bookingCourt, setBookingCourt] = useState(null)
  const [bookingComplete, setBookingComplete] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [token, setToken] = useState(() => sessionStorage.getItem('bookingToken') || '')
  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [bookingsOpen, setBookingsOpen] = useState(false)
  const [bookings, setBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [bookingsError, setBookingsError] = useState('')
  const [notice, setNotice] = useState('')

  const filters = useMemo(() => ['ทั้งหมด', ...new Set(rooms.map((room) => displayRoomType(room.type)))], [rooms])
  const filteredRooms = useMemo(() => rooms.filter((room) => {
    const type = displayRoomType(room.type)
    const matchesType = filter === 'ทั้งหมด' || type === filter
    const matchesSearch = `${room.name} ${type} ${room.description || ''}`.toLowerCase().includes(search.trim().toLowerCase())
    return matchesType && matchesSearch
  }), [filter, rooms, search])

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

  function startBooking(court) {
    setBookingCourt(court)
    setBookingComplete(false)
    setBookingError('')
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
    setBookingSubmitting(true)
    setBookingError('')
    const formData = new FormData(event.currentTarget)
    const startTime = String(formData.get('start_time') || '')
    const endTime = String(formData.get('end_time') || '')
    if (endTime <= startTime) {
      setBookingError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม')
      setBookingSubmitting(false)
      return
    }
    try {
      await apiRequest('/api/bookings', {
        method: 'POST',
        token,
        body: JSON.stringify({
          room_id: bookingCourt.id,
          booking_date: formData.get('booking_date'),
          start_time: startTime,
          end_time: endTime,
          note: String(formData.get('note') || '').trim(),
        }),
      })
      setBookingComplete(true)
      if (bookingsOpen) await loadBookings()
    } catch (error) {
      setBookingError(error.message)
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
      <div className="flex h-8 items-center justify-center bg-[#1c1d19] px-4 text-center text-[9px] font-semibold tracking-[.13em] text-[#f3efe3] sm:text-[10px]">
        ค้นหาสนามและส่งคำขอจองออนไลน์ได้แล้ว <span className="mx-2 text-[#e2a04b]">✳</span> เลือกพื้นที่ที่ใช่ แล้วชวนทีมมาเล่นกัน
        <a href="#courts" className="ml-2 hidden text-[#e9aa5a] underline underline-offset-2 sm:inline">เลือกสนามเลย</a>
      </div>

      <header className="sticky top-0 z-30 border-b border-black/[.07] bg-[#f2f0e9]/95 backdrop-blur-md">
        <nav className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12" aria-label="เมนูหลัก">
          <a href="#home" className="flex items-center gap-2.5 text-[#1b1c18] no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#df8c37] text-[16px] font-black text-[#191a17]">S.</span>
            <span className="text-[13px] font-black tracking-[.12em]">SANAM<span className="font-normal">DEE</span><span className="ml-1.5 block text-[8px] font-medium tracking-[.2em] text-[#85837b]">SPORTS CLUB · BANGKOK</span></span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#courts" className="text-[10px] font-semibold tracking-[.07em] text-[#494a43] no-underline transition hover:text-[#bd7028]">สนามของเรา</a>
            <a href="#experience" className="text-[10px] font-semibold tracking-[.07em] text-[#494a43] no-underline transition hover:text-[#bd7028]">ประสบการณ์</a>
            <a href="#visit" className="text-[10px] font-semibold tracking-[.07em] text-[#494a43] no-underline transition hover:text-[#bd7028]">สถานที่</a>
          </div>
          <div className="flex items-center gap-2">
            {user && <button type="button" onClick={() => { setBookingsOpen(true); loadBookings() }} className="border border-[#d6d2c8] px-2.5 py-2.5 text-[9px] font-bold text-[#3d3d36] transition hover:border-[#bc782f] sm:px-3">การจอง</button>}
            <button type="button" onClick={() => { if (user) handleLogout(); else { setAuthMode('login'); setAuthError(''); setAuthOpen(true) } }} className="border border-[#d6d2c8] px-3 py-2.5 text-[9px] font-bold text-[#3d3d36] transition hover:border-[#bc782f]">{user ? 'ออกจากระบบ' : 'เข้าสู่ระบบ'}</button>
            <a href="#courts" className="group flex items-center gap-2 bg-[#df8c37] px-4 py-2.5 text-[9px] font-bold tracking-[.08em] text-[#201e19] no-underline transition hover:bg-[#efa957] sm:px-5 sm:text-[10px]">จองสนาม <Icon name="arrow" size={14} className="transition group-hover:translate-x-1" /></a>
          </div>
        </nav>
      </header>

      {notice && <div role="status" className="mx-auto flex max-w-[1344px] items-center justify-between gap-3 bg-[#fff4df] px-5 py-2 text-[10px] text-[#724d23] sm:mx-8 lg:mx-12"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="text-[13px]" aria-label="ปิดข้อความ">×</button></div>}

      <section id="home" className="mx-auto grid max-w-[1440px] gap-7 px-5 pb-9 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-9 lg:px-12 lg:pb-12 lg:pt-10">
        <div className="flex flex-col justify-center lg:py-8">
          <p className="mb-4 flex items-center gap-2 text-[9px] font-bold tracking-[.18em] text-[#a36931] sm:text-[10px]"><span className="h-px w-7 bg-[#c3813e]" />พื้นที่ของคนรักกีฬา · กรุงเทพฯ</p>
          <h1 className="m-0 max-w-[620px] text-[clamp(3.35rem,8vw,6.4rem)] font-black uppercase leading-[.82] tracking-[-.075em] text-[#1c1d19]">MAKE<br />YOUR<br /><span className="text-[#d48235]">MOVE.</span></h1>
          <p className="mb-0 mt-6 max-w-[380px] text-[12px] leading-[1.9] text-[#65645d] sm:text-[13px]">สนามดี ๆ เปลี่ยนวันธรรมดาให้เป็นเกมที่น่าจดจำ เลือกพื้นที่ที่ใช่ ส่งคำขอจอง แล้วชวนทีมมาเล่นกัน</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a href="#courts" className="group flex items-center gap-3 bg-[#1c1d19] px-5 py-3.5 text-[10px] font-bold tracking-[.08em] text-white no-underline transition hover:bg-[#36362f]">ค้นหาสนาม <Icon name="arrow" size={15} className="text-[#e7a14f] transition group-hover:translate-x-1" /></a>
            <a href="#experience" className="text-[10px] font-semibold text-[#4c4a43] no-underline transition hover:text-[#bf762f]">รู้จักสนามดี <span className="ml-1">↘</span></a>
          </div>
          <div className="mt-8 flex items-center gap-5 border-t border-[#d9d6cc] pt-5 sm:mt-10 sm:gap-8">
            <div><p className="m-0 text-[21px] font-black tracking-tight">{roomsLoading ? '…' : rooms.length}</p><p className="mt-0.5 text-[8px] font-semibold tracking-[.12em] text-[#85837b]">พื้นที่พร้อมจอง</p></div>
            <span className="h-8 w-px bg-[#d8d5cc]" />
            <div><p className="m-0 text-[21px] font-black tracking-tight">{filters.length - 1}</p><p className="mt-0.5 text-[8px] font-semibold tracking-[.12em] text-[#85837b]">ประเภทพื้นที่</p></div>
            <span className="h-8 w-px bg-[#d8d5cc]" />
            <div><p className="m-0 text-[21px] font-black tracking-tight">24<span className="ml-1 text-[13px] text-[#d98a39]">h</span></p><p className="mt-0.5 text-[8px] font-semibold tracking-[.12em] text-[#85837b]">จองออนไลน์</p></div>
          </div>
        </div>

        <div className="relative min-h-[300px] overflow-hidden bg-[#393b34] sm:min-h-[440px] lg:min-h-[550px]">
          <img src="https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1800&q=90" alt="สนามบาสเกตบอลในร่มพร้อมแป้นบาส" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/5" />
          <div className="absolute left-5 top-5 flex items-center gap-2 border border-white/40 bg-black/20 px-3 py-2 text-[8px] font-semibold tracking-[.14em] text-white backdrop-blur-sm sm:left-7 sm:top-7"><span className="h-1.5 w-1.5 rounded-full bg-[#efad5d]" /> CHECK VENUES & BOOK ONLINE</div>
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white sm:bottom-8 sm:left-8 sm:right-8">
            <div><p className="mb-2 text-[8px] font-bold tracking-[.18em] text-[#edb36f]">THE HOME COURT</p><p className="m-0 text-[24px] font-black uppercase leading-none tracking-[-.04em] sm:text-[36px]">เกมของคุณ<br />เริ่มตรงนี้</p></div>
            <a href="#courts" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 text-white no-underline transition hover:border-[#e7a14f] hover:bg-[#e7a14f] hover:text-black sm:h-12 sm:w-12"><Icon name="arrow" size={19} /></a>
          </div>
          <div className="absolute bottom-0 right-0 bg-[#df8c37] px-4 py-3 text-[8px] font-bold tracking-[.12em] text-[#1b1b17] sm:px-5"><span className="text-[12px]">01</span> / 04</div>
        </div>
      </section>

      <div className="overflow-hidden bg-[#df8c37] py-3.5 text-[#22221c]" aria-label="พื้นที่สำหรับทุกเกม">
        <div className="flex min-w-max animate-[marquee_28s_linear_infinite] items-center gap-7 whitespace-nowrap text-[10px] font-black tracking-[.18em] sm:gap-10 sm:text-[12px]">
          {[0, 1, 2, 3].map((item) => <span key={item} className="flex items-center gap-7 sm:gap-10">PLAY YOUR GAME <span className="text-[17px] font-normal">✳</span> BOOK YOUR COURT <span className="text-[17px] font-normal">✳</span> BRING YOUR PEOPLE <span className="text-[17px] font-normal">✳</span></span>)}
        </div>
      </div>

      <section id="experience" className="mx-auto grid max-w-[1440px] gap-7 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[.8fr_1.2fr] lg:gap-14 lg:px-12 lg:py-24">
        <div className="relative min-h-[260px] overflow-hidden bg-[#b4ad9c] sm:min-h-[360px]">
          <img src="https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1000&q=85" alt="ผู้เล่นกำลังฝึกซ้อมในสนามกีฬา" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute bottom-5 left-5 text-white"><p className="mb-1 text-[8px] font-bold tracking-[.17em] text-[#f0b269]">GOOD GAME, GOOD PEOPLE</p><p className="m-0 text-[17px] font-bold">พื้นที่ที่ชวนให้กลับมาเล่นอีก</p></div>
          <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#df8c37] text-[8px] font-black leading-tight text-center text-[#1c1d19]">PLAY<br />MORE</div>
        </div>
        <div className="flex flex-col justify-center py-2 lg:py-6">
          <p className="mb-3 text-[9px] font-bold tracking-[.17em] text-[#aa7137]">มากกว่าแค่พื้นที่เล่นกีฬา</p>
          <h2 className="m-0 max-w-[570px] text-[32px] font-black uppercase leading-[.97] tracking-[-.06em] sm:text-[48px]">พื้นที่ดี ๆ<br />ทำให้ทุกเกม<br /><span className="text-[#d48235]">มีความหมาย.</span></h2>
          <p className="mb-0 mt-4 max-w-[490px] text-[11px] leading-[1.9] text-[#68675f] sm:text-[12px]">เราคัดสรรสนามที่ได้มาตรฐาน ดูแลทุกพื้นที่ให้พร้อมเล่น และทำให้การจองเป็นเรื่องง่าย เพื่อให้คุณใช้เวลาไปกับเกมและคนสำคัญได้เต็มที่</p>
          <div className="mt-6 grid max-w-[500px] grid-cols-2 gap-x-5 gap-y-4 border-t border-[#d9d6cc] pt-5">
            {[['01', 'จองง่ายในไม่กี่ขั้นตอน'], ['02', 'ดูข้อมูลสถานที่ก่อนจอง'], ['03', 'ส่งคำขอผ่านระบบออนไลน์'], ['04', 'ตรวจสอบสถานะการจองได้']].map(([number, text]) => <div key={number} className="flex items-start gap-2.5"><span className="text-[9px] font-bold text-[#c47a34]">{number}</span><span className="text-[10px] font-semibold text-[#484941]">{text}</span></div>)}
          </div>
        </div>
      </section>

      <section id="courts" className="bg-[#1c1d19] px-5 py-12 text-[#f4f0e5] sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-[1344px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9">
            <div><p className="mb-2 text-[9px] font-bold tracking-[.18em] text-[#dfa052]">FIND YOUR PLAYING FIELD</p><h2 className="m-0 text-[31px] font-black uppercase leading-none tracking-[-.055em] sm:text-[43px]">เลือกสนาม.<br className="sm:hidden" /> แล้วลงเล่น.</h2><p className="mb-0 mt-2 text-[10px] text-[#aaa99f] sm:text-[11px]">เลือกพื้นที่ที่ใช่ แล้วส่งคำขอจองได้ทันที</p></div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <label className="flex min-w-[170px] flex-1 items-center gap-2 border border-white/20 px-3 py-2.5 text-[#b8b7ae] sm:flex-none"><Icon name="search" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาสนาม..." aria-label="ค้นหาสนาม" className="w-full bg-transparent text-[10px] text-white outline-none placeholder:text-[#85857d] sm:w-[135px]" /></label>
              <div className="hide-scrollbar flex max-w-full gap-1 overflow-x-auto sm:max-w-[400px]">
                {filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`shrink-0 border px-3 py-2.5 text-[9px] font-semibold transition ${filter === item ? 'border-[#df8c37] bg-[#df8c37] text-[#1c1d19]' : 'border-white/20 text-[#d2d0c6] hover:border-white/50'}`}>{item}</button>)}
              </div>
            </div>
          </div>

          {roomsLoading ? <div role="status" className="border border-white/15 py-14 text-center text-[11px] text-[#c8c6bc]">กำลังโหลดรายการสถานที่…</div> : roomsError ? <div role="alert" className="border border-red-200/30 bg-red-950/20 py-10 text-center"><p className="text-[12px] font-semibold">โหลดรายการสถานที่ไม่สำเร็จ</p><p className="mt-1 text-[10px] text-[#c8c6bc]">{roomsError}</p><button type="button" onClick={loadRooms} className="mt-3 border border-[#df8c37] px-4 py-2 text-[10px] font-bold text-[#edb16b]">ลองอีกครั้ง</button></div> : filteredRooms.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredRooms.map((room) => <article key={room.id} className="group bg-[#282923]">
              <div className="relative h-[190px] overflow-hidden sm:h-[210px]"><img src={roomImage(room)} alt={room.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><span className="absolute left-3 top-3 border border-white/40 bg-black/20 px-2 py-1 text-[8px] font-bold tracking-[.16em] text-white backdrop-blur-sm">{displayRoomType(room.type).toUpperCase()}</span><span className="absolute bottom-3 left-3 text-[9px] text-white">{room.capacity ? `รองรับ ${room.capacity} คน` : 'สอบถามจำนวนผู้ใช้บริการ'}</span></div>
              <div className="p-4"><div className="mb-1 flex items-center justify-between gap-2"><p className="m-0 text-[8px] font-bold tracking-[.15em] text-[#dfa052]">#{room.id} · {displayRoomType(room.type)}</p><span className="text-[8px] text-[#a9a89f]"><Icon name="clock" size={11} className="mr-1 inline align-[-2px]" />ดูรายละเอียดสถานที่</span></div><h3 className="mb-1.5 mt-1 text-[14px] font-bold text-[#f5f1e7]">{room.name}</h3><p className="mb-4 min-h-[36px] text-[9px] leading-[1.7] text-[#a8a79e]">{room.description || 'ติดต่อสอบถามรายละเอียดเพิ่มเติมเกี่ยวกับสถานที่นี้'}</p><div className="flex items-end justify-between border-t border-white/10 pt-3"><p className="m-0"><span className="text-[8px] text-[#a8a79f]">ราคา</span><br /><b className="text-[13px] text-[#f4f0e5]">สอบถาม</b></p><button type="button" onClick={() => startBooking(room)} className="group/button flex items-center gap-2 bg-[#df8c37] px-3 py-2.5 text-[9px] font-bold text-[#1c1d19] transition hover:bg-[#f1ad60]">จองสนาม <Icon name="arrow" size={13} className="transition group-hover/button:translate-x-1" /></button></div></div>
            </article>)}
          </div> : <div className="border border-dashed border-white/20 py-14 text-center"><p className="text-[12px] font-semibold">{rooms.length ? 'ไม่พบสถานที่ที่ตรงกับการค้นหา' : 'ขณะนี้ยังไม่มีสถานที่เปิดให้จอง'}</p>{rooms.length > 0 && <button type="button" onClick={() => { setSearch(''); setFilter('ทั้งหมด') }} className="mt-2 text-[10px] text-[#e3a456] underline underline-offset-4">ล้างตัวกรอง</button>}</div>}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5"><p className="m-0 text-[9px] text-[#aaa99f]">เลือกพื้นที่ที่เหมาะกับทีมของคุณ <a href="#courts" className="ml-1 font-semibold text-[#e2a557] no-underline">ดูรายการสนาม ↗</a></p><p className="m-0 text-[8px] tracking-[.13em] text-[#8e8d85]">ALL COURTS · YOUR GAME</p></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-7 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_.8fr] lg:items-center lg:gap-16 lg:px-12 lg:py-20">
        <div><p className="mb-2 text-[9px] font-bold tracking-[.17em] text-[#a76d34]">HOW TO PLAY</p><h2 className="m-0 text-[30px] font-black uppercase leading-[.97] tracking-[-.055em] sm:text-[42px]">สามขั้นตอน<br />ก็พร้อมลงสนาม.</h2></div>
        <div className="grid gap-0 sm:grid-cols-3">
          {[['01', 'เลือกสนาม', 'เลือกประเภทสนามให้ตรงกับเกมของคุณ'], ['02', 'เลือกวันและเวลา', 'ระบุวันที่และเวลาที่สะดวก'], ['03', 'ส่งคำขอจอง', 'ติดตามสถานะการจองได้จากบัญชีของคุณ']].map(([number, title, detail]) => <div key={number} className="flex gap-3 border-t border-[#d9d6cc] py-4 sm:block sm:border-l sm:border-t-0 sm:pl-4 sm:pt-2"><span className="text-[10px] font-bold text-[#c47a34]">{number}</span><div><h3 className="m-0 text-[12px] font-bold">{title}</h3><p className="mb-0 mt-1 text-[9px] leading-relaxed text-[#77766e]">{detail}</p></div></div>)}
        </div>
      </section>

      <section id="visit" className="relative mx-5 mb-9 overflow-hidden bg-[#df8c37] sm:mx-8 lg:mx-12">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border border-black/10 sm:h-80 sm:w-80" />
        <div className="absolute -right-2 -top-12 h-52 w-52 rounded-full border border-black/10 sm:h-64 sm:w-64" />
        <div className="relative flex flex-col justify-between gap-5 px-5 py-7 sm:flex-row sm:items-end sm:px-8 sm:py-9 lg:px-12 lg:py-11">
          <div><p className="mb-2 text-[8px] font-bold tracking-[.18em] text-[#563718]">READY WHEN YOU ARE</p><h2 className="m-0 text-[27px] font-black uppercase leading-[.9] tracking-[-.06em] sm:text-[42px]">นัดทีมให้พร้อม.<br />ที่เหลือเราจัดให้.</h2><p className="mb-0 mt-3 max-w-[450px] text-[10px] leading-relaxed text-[#4f3923]">สนามพร้อม ทีมงานพร้อม เหลือแค่คุณกับเพื่อน ๆ แล้วมาเจอกัน</p></div>
          <a href="#courts" className="group flex w-fit items-center gap-4 bg-[#1c1d19] px-5 py-3.5 text-[9px] font-bold tracking-[.08em] text-white no-underline transition hover:bg-[#393a33]">จองสนามของคุณ <Icon name="arrow" size={15} className="text-[#e7a14f] transition group-hover:translate-x-1" /></a>
        </div>
      </section>

      <footer className="bg-[#1c1d19] px-5 py-8 text-[#f2f0e9] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1344px] flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><a href="#home" className="text-[13px] font-black tracking-[.14em] text-white no-underline">SANAM<span className="font-normal">DEE</span></a><p className="mb-0 mt-2 text-[9px] text-[#a4a39b]">พื้นที่ดี ๆ สำหรับทุกเกมของคุณ · กรุงเทพฯ</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[9px] text-[#c3c1b8]"><a href="#courts" className="text-inherit no-underline hover:text-[#e3a456]">สนามของเรา</a><a href="#experience" className="text-inherit no-underline hover:text-[#e3a456]">เกี่ยวกับสนามดี</a><a href="#visit" className="text-inherit no-underline hover:text-[#e3a456]">วิธีจอง</a></div>
          <p className="m-0 text-[8px] text-[#85847c]">© 2026 SANAMDEE SPORTS CLUB</p>
        </div>
      </footer>

      {bookingCourt && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeBooking() }}>
        <section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="max-h-[92vh] w-full max-w-[460px] overflow-y-auto bg-[#f2f0e9] p-5 shadow-2xl sm:p-7">
          <div className="mb-4 flex items-start justify-between"><div><p className="mb-1 text-[8px] font-bold tracking-[.17em] text-[#a76d34]">BOOK YOUR COURT · #{bookingCourt.id}</p><h2 id="booking-title" className="m-0 text-[18px] font-black">{bookingComplete ? 'ส่งคำขอจองแล้ว' : bookingCourt.name}</h2></div><button type="button" onClick={closeBooking} className="flex h-8 w-8 items-center justify-center border border-[#d8d5cc] text-[#45463f]" aria-label="ปิดหน้าต่าง"><Icon name="close" size={16} /></button></div>
          {bookingComplete ? <div className="py-7 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#df8c37]"><Icon name="check" size={26} /></div><p className="text-[11px] leading-relaxed text-[#68675f]">ส่งคำขอจองเรียบร้อย สถานะเริ่มต้นคือ “รอยืนยัน”<br />ตรวจสอบความคืบหน้าได้ที่รายการจองของฉัน</p><button type="button" onClick={closeBooking} className="mt-4 bg-[#1c1d19] px-7 py-3 text-[10px] font-bold text-white">เรียบร้อย</button></div> : <><img src={roomImage(bookingCourt)} alt="" className="mb-4 h-[150px] w-full object-cover" /><p className="mb-4 text-[10px] leading-relaxed text-[#6d6c64]">{bookingCourt.description || 'ติดต่อสอบถามรายละเอียดเพิ่มเติมเกี่ยวกับสถานที่นี้'}</p><div className="mb-4 flex items-center justify-between border-y border-[#d8d5cc] py-3"><span className="text-[9px] text-[#77766e]">ประเภท / รองรับ</span><b className="text-[11px]">{displayRoomType(bookingCourt.type)} · {bookingCourt.capacity ? `${bookingCourt.capacity} คน` : 'ไม่ระบุ'}</b></div>
            <form onSubmit={handleBookingSubmit} className="space-y-3">
              <label className="block text-[9px] font-bold text-[#4b4b44]">วันที่ต้องการจอง<input name="booking_date" type="date" required min={today} className="mt-1.5 w-full border border-[#d8d5cc] bg-white px-3 py-2.5 text-[10px] font-normal outline-none focus:border-[#b97632]" /></label>
              <div className="grid grid-cols-2 gap-3"><label className="block text-[9px] font-bold text-[#4b4b44]">เวลาเริ่ม<input name="start_time" type="time" required step="1800" className="mt-1.5 w-full border border-[#d8d5cc] bg-white px-3 py-2.5 text-[10px] font-normal outline-none focus:border-[#b97632]" /></label><label className="block text-[9px] font-bold text-[#4b4b44]">เวลาสิ้นสุด<input name="end_time" type="time" required step="1800" className="mt-1.5 w-full border border-[#d8d5cc] bg-white px-3 py-2.5 text-[10px] font-normal outline-none focus:border-[#b97632]" /></label></div>
              <label className="block text-[9px] font-bold text-[#4b4b44]">หมายเหตุ (ไม่บังคับ)<textarea name="note" maxLength="500" rows="2" placeholder="เช่น จำนวนผู้เล่น หรือรายละเอียดเพิ่มเติม" className="mt-1.5 w-full resize-y border border-[#d8d5cc] bg-white px-3 py-2.5 text-[10px] font-normal outline-none placeholder:text-[#aaa79e] focus:border-[#b97632]" /></label>
              {bookingError && <p role="alert" className="m-0 border border-red-300 bg-red-50 px-3 py-2 text-[10px] text-red-800">{bookingError}</p>}
              <button type="submit" disabled={bookingSubmitting} className="mt-2 w-full bg-[#df8c37] py-3 text-[10px] font-black tracking-[.06em] text-[#1c1d19] transition hover:bg-[#eda553] disabled:cursor-wait disabled:opacity-60">{bookingSubmitting ? 'กำลังส่งคำขอ…' : 'ส่งคำขอจอง'} <span className="ml-1">→</span></button>
              <p className="m-0 text-center text-[8px] text-[#8d8b82]">ระบบจะตรวจสอบเวลาซ้ำให้อัตโนมัติ</p>
            </form>
          </>}
        </section>
      </div>}

      {authOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="w-full max-w-[420px] bg-[#f2f0e9] p-5 shadow-2xl sm:p-7">
          <div className="mb-5 flex items-start justify-between"><div><p className="mb-1 text-[8px] font-bold tracking-[.17em] text-[#a76d34]">SANAMDEE MEMBERS</p><h2 id="auth-title" className="m-0 text-[20px] font-black">{authMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h2></div><button type="button" onClick={() => setAuthOpen(false)} className="flex h-8 w-8 items-center justify-center border border-[#d8d5cc] text-[#45463f]" aria-label="ปิดหน้าต่าง"><Icon name="close" size={16} /></button></div>
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {authMode === 'register' && <label className="block text-[9px] font-bold text-[#4b4b44]">ชื่อที่แสดง<input name="name" required maxLength="200" autoComplete="name" className="mt-1.5 w-full border border-[#d8d5cc] bg-white px-3 py-2.5 text-[10px] font-normal outline-none focus:border-[#b97632]" /></label>}
            <label className="block text-[9px] font-bold text-[#4b4b44]">อีเมล<input name="email" type="email" required maxLength="254" autoComplete="email" className="mt-1.5 w-full border border-[#d8d5cc] bg-white px-3 py-2.5 text-[10px] font-normal outline-none focus:border-[#b97632]" /></label>
            <label className="block text-[9px] font-bold text-[#4b4b44]">รหัสผ่าน<input name="password" type="password" required minLength="8" maxLength="128" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} className="mt-1.5 w-full border border-[#d8d5cc] bg-white px-3 py-2.5 text-[10px] font-normal outline-none focus:border-[#b97632]" /><span className="mt-1 block font-normal text-[#8d8b82]">อย่างน้อย 8 ตัวอักษร</span></label>
            {authError && <p role="alert" className="m-0 border border-red-300 bg-red-50 px-3 py-2 text-[10px] text-red-800">{authError}</p>}
            <button type="submit" disabled={authSubmitting} className="w-full bg-[#df8c37] py-3 text-[10px] font-black text-[#1c1d19] transition hover:bg-[#eda553] disabled:cursor-wait disabled:opacity-60">{authSubmitting ? 'กำลังดำเนินการ…' : authMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครและเข้าสู่ระบบ'}</button>
          </form>
          <p className="mb-0 mt-4 text-center text-[9px] text-[#77766e]">{authMode === 'login' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?'} <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }} className="font-bold text-[#a76d34] underline underline-offset-2">{authMode === 'login' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</button></p>
        </section>
      </div>}

      {bookingsOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setBookingsOpen(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="my-bookings-title" className="max-h-[85vh] w-full max-w-[600px] overflow-y-auto bg-[#f2f0e9] p-5 shadow-2xl sm:p-7">
          <div className="mb-5 flex items-start justify-between"><div><p className="mb-1 text-[8px] font-bold tracking-[.17em] text-[#a76d34]">YOUR RESERVATIONS</p><h2 id="my-bookings-title" className="m-0 text-[20px] font-black">การจองของฉัน</h2></div><button type="button" onClick={() => setBookingsOpen(false)} className="flex h-8 w-8 items-center justify-center border border-[#d8d5cc] text-[#45463f]" aria-label="ปิดหน้าต่าง"><Icon name="close" size={16} /></button></div>
          {bookingsLoading ? <p role="status" className="py-8 text-center text-[11px] text-[#77766e]">กำลังโหลดรายการจอง…</p> : bookingsError ? <div role="alert" className="border border-red-300 bg-red-50 p-4 text-[10px] text-red-800">{bookingsError}<button type="button" onClick={() => loadBookings()} className="ml-2 font-bold underline">ลองอีกครั้ง</button></div> : bookings.length === 0 ? <p className="py-8 text-center text-[11px] text-[#77766e]">ยังไม่มีรายการจอง</p> : <div className="space-y-3">{bookings.map((booking) => {
            const room = rooms.find((item) => item.id === booking.room_id)
            const canCancel = ['pending', 'approved', 'confirmed'].includes(booking.status)
            return <article key={booking.id} className="border border-[#dedbd1] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-[12px] font-bold">{room?.name || `สถานที่ #${booking.room_id}`}</p><p className="mb-0 mt-1 text-[10px] text-[#77766e]">{booking.booking_date} · {formatBookingTime(booking.start_time)}–{formatBookingTime(booking.end_time)}</p>{booking.note && <p className="mb-0 mt-1 text-[9px] text-[#77766e]">หมายเหตุ: {booking.note}</p>}</div><span className="bg-[#f3eee4] px-2 py-1 text-[9px] font-bold text-[#8c5c28]">{formatBookingStatus(booking.status)}</span></div>
              {canCancel && <button type="button" onClick={() => cancelBooking(booking.id)} className="mt-3 border border-[#d9d4c8] px-3 py-1.5 text-[9px] font-semibold text-[#6e6252] hover:border-red-300 hover:text-red-700">ยกเลิกการจอง</button>}
            </article>
          })}</div>}
        </section>
      </div>}
    </main>
  )
}

export default App

import { useState } from 'react'
import { apiRequest } from './api'

function PasswordChangeDialog({ token, onClose, onChanged }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const formData = new FormData(event.currentTarget)
    const currentPassword = String(formData.get('current_password') || '')
    const newPassword = String(formData.get('new_password') || '')
    const confirmPassword = String(formData.get('confirm_password') || '')

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน')
      return
    }

    setSubmitting(true)
    try {
      await apiRequest('/api/auth/password', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })
      onChanged()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="password-title" className="w-full max-w-[460px] rounded-t-2xl bg-[#f5f4ef] p-5 shadow-2xl sm:rounded-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#dedbd1] pb-4"><div><p className="mb-1 text-[19px] font-bold text-[#925c2b]">ACCOUNT SECURITY</p><h2 id="password-title" className="m-0 text-[27px] font-black text-[#24251f]">เปลี่ยนรหัสผ่าน</h2><p className="mb-0 mt-1 text-[19px] leading-relaxed text-[#68675f]">ตั้งรหัสผ่านใหม่เพื่อรักษาความปลอดภัยของบัญชี</p></div><button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8d5cc] bg-white text-[28px] leading-none text-[#45463f] transition hover:bg-[#ebe9e1]" aria-label="ปิดหน้าต่าง">×</button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-[19px] font-bold text-[#3d3d36]">รหัสผ่านปัจจุบัน<input name="current_password" type="password" autoComplete="current-password" minLength="8" maxLength="128" required className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f]" /></label>
          <label className="block text-[19px] font-bold text-[#3d3d36]">รหัสผ่านใหม่<input name="new_password" type="password" autoComplete="new-password" minLength="8" maxLength="128" required className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f]" /></label>
          <label className="block text-[19px] font-bold text-[#3d3d36]">ยืนยันรหัสผ่านใหม่<input name="confirm_password" type="password" autoComplete="new-password" minLength="8" maxLength="128" required className="mt-1.5 min-h-12 w-full rounded-md border border-[#cbc8be] bg-white px-3 py-2.5 text-[19px] font-normal text-[#24251f]" /></label>
          {error && <p role="alert" className="m-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[19px] leading-relaxed text-red-800">{error}</p>}
          <p className="m-0 rounded-md bg-[#eeeae1] p-3 text-[19px] leading-relaxed text-[#595950]">เปลี่ยนรหัสผ่านแล้ว ระบบจะออกจากทุกอุปกรณ์และให้เข้าสู่ระบบใหม่</p>
          <button type="submit" disabled={submitting} className="min-h-12 w-full rounded-md bg-[#df8c37] py-3 text-[19px] font-black text-[#1c1d19] transition hover:bg-[#eda553] disabled:opacity-50">{submitting ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}</button>
        </form>
      </section>
    </div>
  )
}

export default PasswordChangeDialog

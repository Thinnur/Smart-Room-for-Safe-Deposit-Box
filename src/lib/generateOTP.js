/**
 * generateOTP.js
 * Utility untuk generate OTP kriptografis dan request akses ke Supabase.
 *
 * Menggunakan Web Crypto API (CSPRNG) bukan Math.random().
 * Rejection sampling untuk hindari modulo bias.
 *
 * CATATAN: commands.id di DB adalah bigint (bukan uuid).
 * requestOTPAccess() mengembalikan cmdId sebagai number — handle sesuai.
 */

/**
 * Hasilkan satu digit acak kriptografis di range [1..max] tanpa bias.
 * @param {number} max - Jumlah tombol (default 6)
 * @returns {number} digit 1..max
 */
function secureRandomDigit(max) {
  const limit = 256 - (256 % max); // buang nilai yang bikin bias
  const buf = new Uint8Array(1);
  let val;
  do {
    crypto.getRandomValues(buf);  // CSPRNG dari OS
    val = buf[0];
  } while (val >= limit);
  return (val % max) + 1;
}

/**
 * Generate OTP string kriptografis.
 * @param {number} numButtons - Jumlah tombol fisik (default 6)
 * @param {number} length     - Panjang OTP (default 4)
 * @returns {string} OTP, misal "3142"
 */
export function generateOTP(numButtons = 6, length = 4) {
  return Array.from({ length }, () => secureRandomDigit(numButtons)).join('');
}

/**
 * Insert command OTP_UNLOCK ke Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} nasabahId - UUID nasabah dari tabel nasabah
 * @param {number} validMinutes - Durasi OTP valid dalam menit (default 5)
 * @returns {Promise<{ cmdId: number, otpCode: string, expiresAt: string }>}
 * @throws jika Supabase error
 */
export async function requestOTPAccess(supabase, nasabahId, validMinutes = 5) {
  const otpCode   = generateOTP(6, 4);
  const expiresAt = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('commands')
    .insert({
      type: 'OTP_UNLOCK',
      status: 'pending',
      payload: {
        nasabah_id: nasabahId,
        otp_code: otpCode,
        expires_at: expiresAt,
        progress: '',
      },
    })
    .select('id')
    .single();

  if (error) throw error;

  // data.id adalah bigint → number di JS
  return { cmdId: data.id, otpCode, expiresAt };
}

/**
 * Batalkan OTP yang sedang aktif (PATCH status → cancelled).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} cmdId - ID command dari requestOTPAccess()
 */
export async function cancelOTPAccess(supabase, cmdId) {
  const { error } = await supabase
    .from('commands')
    .update({ status: 'cancelled' })
    .eq('id', cmdId);

  if (error) throw error;
}

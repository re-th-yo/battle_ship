import { supabase } from './supabase.js'

export async function getRoomById(roomId) {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single()
  if (error) throw error
  return data
}

export async function submitLayout(roomId, role, units) {
  const col = role === 'host' ? 'host_layout' : 'guest_layout'
  const { error } = await supabase.from('rooms').update({ [col]: units }).eq('id', roomId)
  if (error) throw error
}

export async function submitShot(roomId, role, shot) {
  const col = role === 'host' ? 'host_shots' : 'guest_shots'
  const { data, error: readErr } = await supabase
    .from('rooms').select(col).eq('id', roomId).single()
  if (readErr) throw readErr
  const current = data[col] || []
  const { error } = await supabase
    .from('rooms').update({ [col]: [...current, shot] }).eq('id', roomId)
  if (error) throw error
}

export async function submitGltch(roomId, role, jamTurns) {
  const col = role === 'host' ? 'guest_jam' : 'host_jam'
  const { error } = await supabase.from('rooms').update({ [col]: jamTurns }).eq('id', roomId)
  if (error) throw error
}

export async function submitJam(roomId, role, value) {
  const col = role === 'host' ? 'host_jam' : 'guest_jam'
  const { error } = await supabase.from('rooms').update({ [col]: value }).eq('id', roomId)
  if (error) throw error
}

export async function submitAction(roomId, role, action) {
  const col = role === 'host' ? 'host_action' : 'guest_action'
  const { error } = await supabase.from('rooms').update({ [col]: action }).eq('id', roomId)
  if (error) throw error
}

export async function setFirstPlayer(roomId, firstPlayer) {
  const { error } = await supabase.from('rooms').update({ first_player: firstPlayer }).eq('id', roomId)
  if (error) throw error
}

export function subscribeToGame(roomId, callback) {
  return supabase
    .channel(`game-${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
    }, payload => callback(payload.new))
    .subscribe()
}

export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  return Promise.resolve()
}

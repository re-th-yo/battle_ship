import { supabase } from './supabase.js'

function generateCode() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
}

function randomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export function getPlayerId() {
  let id = localStorage.getItem('battle_player_id')
  if (!id) {
    id = randomId()
    localStorage.setItem('battle_player_id', id)
  }
  return id
}

export async function createRoom() {
  const code = generateCode()
  const hostId = getPlayerId()
  const { data, error } = await supabase
    .from('rooms')
    .insert({ code, host_id: hostId })
    .select()
    .single()
  if (error) throw error
  return { room: data, playerId: hostId, role: 'host' }
}

export async function joinRoom(code) {
  const guestId = getPlayerId()
  const { data: room, error: findError } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase().trim())
    .eq('status', 'waiting')
    .is('guest_id', null)
    .single()

  if (findError || !room) throw new Error('Code invalide ou salle déjà pleine')

  const { data, error } = await supabase
    .from('rooms')
    .update({ guest_id: guestId, status: 'playing' })
    .eq('id', room.id)
    .select()
    .single()

  if (error) throw error
  return { room: data, playerId: guestId, role: 'guest' }
}

export function subscribeToRoom(roomId, callback) {
  return supabase
    .channel(`room-${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
    }, payload => callback(payload.new))
    .subscribe()
}

export async function deleteRoom(roomId) {
  await supabase.from('rooms').delete().eq('id', roomId)
}

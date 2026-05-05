import type { ClientMessage, ServerMessage } from '../types'

type MessageHandler = (payload: any) => void

class WsClient {
  private ws: WebSocket | null = null
  private listeners = new Map<string, Set<MessageHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private url: string = ''
  private reconnectAttempts = 0
  private intentionalClose = false

  connect(url: string): void {
    this.url = url
    this.intentionalClose = false
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.dispatch('connected', {})
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage
        const handlers = this.listeners.get(msg.type)
        if (handlers) {
          handlers.forEach((fn) => fn(msg.payload))
        }
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.dispatch('disconnected', {})
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      // close event handles cleanup
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    } else {
      this.dispatch('send_failed', { reason: 'disconnected' })
    }
  }

  on(type: string, fn: MessageHandler): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(fn)
  }

  off(type: string, fn: MessageHandler): void {
    this.listeners.get(type)?.delete(fn)
  }

  private dispatch(type: string, payload: any): void {
    const handlers = this.listeners.get(type)
    if (handlers) {
      handlers.forEach((fn) => fn(payload))
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(this.url), delay)
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }
}

export const wsClient = new WsClient()

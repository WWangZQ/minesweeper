import type { ClientMessage, ServerMessage } from '../types'

type MessageHandler = (payload: any) => void

class WsClient {
  private ws: WebSocket | null = null
  private listeners = new Map<string, Set<MessageHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private url: string = ''
  private reconnectAttempts = 0
  private intentionalClose = false
  private pendingQueue: ClientMessage[] = []
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null
  private pingInterval: ReturnType<typeof setInterval> | null = null

  connect(url: string): void {
    this.url = url
    this.intentionalClose = false
    this.pendingQueue = []
    this.ws = new WebSocket(url)

    // Give 3 seconds for connection, then fire failed for any queued messages
    this.connectionTimeout = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        for (const _ of this.pendingQueue) {
          this.dispatch('send_failed', { reason: 'timeout' })
        }
        this.pendingQueue = []
      }
    }, 3000)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      if (this.connectionTimeout) { clearTimeout(this.connectionTimeout); this.connectionTimeout = null }
      this.dispatch('connected', {})
      // Flush pending queue
      for (const msg of this.pendingQueue) {
        this.ws!.send(JSON.stringify(msg))
      }
      this.pendingQueue = []
      // Start heartbeat to prevent idle timeout
      this.startPing()
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
      this.stopPing()
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
    } else if (this.ws?.readyState === WebSocket.CONNECTING) {
      // Queue up to 50 messages while connecting
      if (this.pendingQueue.length < 50) {
        this.pendingQueue.push(msg)
      }
    } else {
      // Only fail if definitely closed/aborted
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
    this.stopPing()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.connectionTimeout) { clearTimeout(this.connectionTimeout); this.connectionTimeout = null }
    this.pendingQueue = []
    this.ws?.close()
    this.ws = null
  }

  private startPing(): void {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 45000) // every 45 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }
}

export const wsClient = new WsClient()

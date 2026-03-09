import { open, Protocol, type SimConnectConnection, type RecvOpen } from 'node-simconnect';
import { EventEmitter } from 'events';
import { registerAllDefinitions, requestAllData, subscribeSystemEvents, setDataRate, SystemEventID, RequestID } from './definitions';
import { readPosition, readEngine, readFuel, readFlightState, readAutopilot, readRadio, readAircraftInfo } from './reader';
import type { ISimConnectManager } from './types';

/** Timeout for a single open() attempt — prevents hanging when MSFS pipe exists but isn't responding. */
const OPEN_TIMEOUT_MS = 10_000;

/** Max diagnostic events to keep in ring buffer. */
const DIAG_MAX = 200;

export interface DiagEvent {
  ts: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

/**
 * SimConnect connection manager.
 * Handles connection lifecycle, auto-reconnect, and data dispatch.
 */
export class SimConnectManager extends EventEmitter implements ISimConnectManager {
  private handle: SimConnectConnection | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private _simInfo: Partial<RecvOpen> = {};
  private _closing = false;
  private _loggedReadError = false;
  private _lastError = '';
  private _attemptCount = 0;

  /** Diagnostic event ring buffer — viewable from renderer DevTools. */
  private _diagLog: DiagEvent[] = [];

  constructor(private reconnectInterval = 5000) {
    super();
  }

  /** Push a diagnostic event and emit it for IPC forwarding. */
  private diag(level: DiagEvent['level'], msg: string): void {
    const entry: DiagEvent = { ts: new Date().toISOString(), level, msg };
    this._diagLog.push(entry);
    if (this._diagLog.length > DIAG_MAX) this._diagLog.shift();
    try { console.log(`[SimConnect:${level}] ${msg}`); } catch { /* EPIPE if pipe closed */ }
    this.emit('diagnostic', entry);
  }

  /** Return the full diagnostic log (for on-demand IPC pull). */
  getDiagnosticLog(): DiagEvent[] {
    return [...this._diagLog];
  }

  get connected(): boolean {
    return this._connected;
  }

  getConnectionStatus() {
    return {
      connected: this._connected,
      simulator: this.detectSimVersion(),
      simConnectVersion: this._simInfo.applicationVersionMajor
        ? `${this._simInfo.applicationVersionMajor}.${this._simInfo.applicationVersionMinor}`
        : 'unknown',
      applicationName: this._simInfo.applicationName || 'unknown',
      lastUpdate: new Date().toISOString(),
      lastError: this._lastError || undefined,
    };
  }

  /**
   * Begins the connection loop. Automatically retries on failure.
   */
  async connect(): Promise<void> {
    this._closing = false;
    this._attemptCount = 0;
    this.diag('info', 'connect() called — starting connection loop');
    this.attemptConnection();
  }

  /**
   * Closes the connection and stops reconnection attempts.
   */
  disconnect(): void {
    this.diag('info', 'disconnect() called — shutting down');
    this._closing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.handle) {
      this.handle.close();
      this.handle = null;
    }
    this._connected = false;
    this.emit('disconnected');
  }

  private _highRate = false;

  setHighRateMode(enabled: boolean): void {
    if (enabled === this._highRate || !this.handle || !this._connected) return;
    this._highRate = enabled;
    setDataRate(this.handle, enabled);
    this.diag('info', `Data rate switched to ${enabled ? 'SIM_FRAME (high)' : 'SECOND (normal)'}`);
  }

  private attemptConnection(): void {
    if (this._closing) {
      this.diag('info', 'attemptConnection() skipped — _closing=true');
      return;
    }

    this._attemptCount++;
    const attempt = this._attemptCount;
    this.diag('info', `Attempt #${attempt}: calling open('SMX ACARS', KittyHawk) with ${OPEN_TIMEOUT_MS}ms timeout`);

    // Race open() against a timeout — prevents hanging when MSFS pipe
    // exists but the SimConnect server isn't responding to handshakes.
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out')), OPEN_TIMEOUT_MS);
    });

    const openStart = Date.now();

    Promise.race([open('SMX ACARS', Protocol.KittyHawk), timeout])
      .then(({ recvOpen, handle }) => {
        const elapsed = Date.now() - openStart;
        this.diag('info', `Attempt #${attempt}: open() resolved in ${elapsed}ms — app="${recvOpen.applicationName}" v${recvOpen.applicationVersionMajor}.${recvOpen.applicationVersionMinor}`);

        if (this._closing) {
          this.diag('warn', `Attempt #${attempt}: _closing=true after open() resolved, closing handle`);
          handle.close();
          return;
        }

        this.handle = handle;
        this._simInfo = recvOpen;
        this._connected = true;
        this._lastError = '';
        this._loggedReadError = false;

        // Register definitions & start data flow
        this.diag('info', `Attempt #${attempt}: registering definitions + requesting data + subscribing events`);
        registerAllDefinitions(handle);
        requestAllData(handle);
        subscribeSystemEvents(handle);

        // Wire up handlers before emitting connected — listeners may
        // query data immediately after the event.
        this.setupDataHandlers(handle);
        this.setupEventHandlers(handle);
        this.setupLifecycleHandlers(handle);

        this.diag('info', `Attempt #${attempt}: emitting 'connected' — _connected=${this._connected}`);
        this.emit('connected', this.getConnectionStatus());
      })
      .catch((err: Error) => {
        const elapsed = Date.now() - openStart;

        // Clean up handle if open() succeeded but something else threw
        if (this.handle && !this._connected) {
          this.diag('warn', `Attempt #${attempt}: cleaning up orphan handle`);
          try { this.handle.close(); } catch { /* ignore */ }
          this.handle = null;
        }

        const msg = err?.message || String(err) || 'Unknown error';
        const errName = err?.name || 'Error';
        const stack = err?.stack?.split('\n').slice(0, 3).join(' | ') || '';
        const isNormal = msg.includes('ECONNREFUSED') || msg.includes('pipe')
          || msg.includes('AggregateError') || err?.name === 'AggregateError'
          || msg.includes('timed out')
          || !msg || msg === 'Unknown error';
        this._lastError = isNormal ? 'Waiting for MSFS...' : msg;

        this.diag(isNormal ? 'info' : 'error',
          `Attempt #${attempt}: FAILED after ${elapsed}ms — ${errName}: ${msg}${stack ? ` [${stack}]` : ''}`);

        this._connected = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });
  }

  private setupDataHandlers(handle: SimConnectConnection): void {
    let dataFrameCount = 0;
    handle.on('simObjectData', (recv) => {
      try {
        dataFrameCount++;
        if (dataFrameCount === 1) {
          this.diag('info', `First simObjectData frame received (requestID=${recv.requestID})`);
        }
        switch (recv.requestID) {
          case RequestID.POSITION:
            this.emit('positionUpdate', readPosition(recv.data));
            break;
          case RequestID.ENGINE:
            this.emit('engineUpdate', readEngine(recv.data));
            break;
          case RequestID.FUEL:
            this.emit('fuelUpdate', readFuel(recv.data));
            break;
          case RequestID.FLIGHT:
            this.emit('flightStateUpdate', readFlightState(recv.data));
            break;
          case RequestID.AUTOPILOT:
            this.emit('autopilotUpdate', readAutopilot(recv.data));
            break;
          case RequestID.RADIO:
            this.emit('radioUpdate', readRadio(recv.data));
            break;
          case RequestID.AIRCRAFT_INFO:
            this.emit('aircraftInfoUpdate', readAircraftInfo(recv.data));
            break;
        }
      } catch (err) {
        // Buffer read errors are non-fatal — skip this frame rather than crashing
        if (!this._loggedReadError) {
          this.diag('warn', `Data read error (requestID=${recv.requestID}): ${(err as Error).message}`);
          this._loggedReadError = true;
        }
      }
    });
  }

  private setupEventHandlers(handle: SimConnectConnection): void {
    handle.on('event', (recv) => {
      switch (recv.clientEventId) {
        case SystemEventID.PAUSE:
          this.diag('info', `Event: PAUSE (data=${recv.data})`);
          this.emit('paused', recv.data === 1);
          break;
        case SystemEventID.SIM_START:
          this.diag('info', 'Event: SIM_START — re-requesting data');
          this.emit('simStart');
          requestAllData(handle);
          break;
        case SystemEventID.SIM_STOP:
          this.diag('info', 'Event: SIM_STOP');
          this.emit('simStop');
          break;
        case SystemEventID.CRASHED:
          this.diag('warn', 'Event: CRASHED');
          this.emit('crashed');
          break;
      }
    });

    handle.on('exception', (recv) => {
      this.diag('error', `SimConnect exception: ${recv.exception} (sendId: ${recv.sendId}, index: ${recv.index})`);
    });
  }

  private setupLifecycleHandlers(handle: SimConnectConnection): void {
    let simQuitting = false;

    handle.on('quit', () => {
      this.diag('info', 'Lifecycle: quit — simulator shutting down');
      simQuitting = true;
      this._connected = false;
      this.handle = null;
      this.emit('disconnected');
      this.scheduleReconnect();
    });

    handle.on('close', () => {
      if (!simQuitting && !this._closing) {
        this.diag('warn', 'Lifecycle: close — connection lost unexpectedly');
        this._connected = false;
        this.handle = null;
        this.emit('disconnected');
        this.scheduleReconnect();
      } else {
        this.diag('info', `Lifecycle: close (expected — simQuitting=${simQuitting}, _closing=${this._closing})`);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this._closing || this.reconnectTimer) {
      this.diag('info', `scheduleReconnect() skipped — _closing=${this._closing}, timerActive=${!!this.reconnectTimer}`);
      return;
    }
    this.diag('info', `Scheduling reconnect in ${this.reconnectInterval / 1000}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptConnection();
    }, this.reconnectInterval);
  }

  private detectSimVersion(): 'msfs2024' | 'msfs2020' | 'unknown' {
    const name = (this._simInfo.applicationName || '').toLowerCase();
    if (name.includes('2024') || name.includes('kittyhawk')) return 'msfs2024';
    if (name.includes('2020') || name.includes('fs2020')) return 'msfs2020';
    return this._connected ? 'msfs2024' : 'unknown'; // default to 2024 for KittyHawk protocol
  }
}

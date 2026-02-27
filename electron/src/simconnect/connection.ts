import { open, Protocol, type SimConnectConnection, type RecvOpen } from 'node-simconnect';
import { EventEmitter } from 'events';
import { registerAllDefinitions, requestAllData, subscribeSystemEvents, SystemEventID, RequestID } from './definitions';
import { readPosition, readEngine, readFuel, readFlightState, readAutopilot, readRadio, readAircraftInfo } from './reader';
import type { ISimConnectManager } from './types';

/** Timeout for a single open() attempt — prevents hanging when MSFS pipe exists but isn't responding. */
const OPEN_TIMEOUT_MS = 10_000;

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

  constructor(private reconnectInterval = 5000) {
    super();
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
    this.attemptConnection();
  }

  /**
   * Closes the connection and stops reconnection attempts.
   */
  disconnect(): void {
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

  private attemptConnection(): void {
    if (this._closing) return;

    console.log(`[SimConnect] Attempting connection...`);

    // Race open() against a timeout — prevents hanging when MSFS pipe
    // exists but the SimConnect server isn't responding to handshakes.
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out')), OPEN_TIMEOUT_MS);
    });

    Promise.race([open('SMX ACARS', Protocol.KittyHawk), timeout])
      .then(({ recvOpen, handle }) => {
        if (this._closing) { handle.close(); return; }

        console.log(`[SimConnect] Connected to ${recvOpen.applicationName} (v${recvOpen.applicationVersionMajor}.${recvOpen.applicationVersionMinor})`);

        this.handle = handle;
        this._simInfo = recvOpen;
        this._connected = true;
        this._lastError = '';
        this._loggedReadError = false;

        // Register definitions & start data flow
        registerAllDefinitions(handle);
        requestAllData(handle);
        subscribeSystemEvents(handle);

        // Wire up handlers before emitting connected — listeners may
        // query data immediately after the event.
        this.setupDataHandlers(handle);
        this.setupEventHandlers(handle);
        this.setupLifecycleHandlers(handle);

        this.emit('connected', this.getConnectionStatus());
      })
      .catch((err: Error) => {
        // Clean up handle if open() succeeded but something else threw
        if (this.handle && !this._connected) {
          try { this.handle.close(); } catch { /* ignore */ }
          this.handle = null;
        }

        const msg = err?.message || String(err) || 'Unknown error';
        const isNormal = msg.includes('ECONNREFUSED') || msg.includes('pipe')
          || msg.includes('AggregateError') || err?.name === 'AggregateError'
          || msg.includes('timed out')
          || !msg || msg === 'Unknown error';
        this._lastError = isNormal ? 'Waiting for MSFS...' : msg;
        console.log(`[SimConnect] Connection failed: ${msg}`);
        this._connected = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });
  }

  private setupDataHandlers(handle: SimConnectConnection): void {
    handle.on('simObjectData', (recv) => {
      try {
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
          console.warn(`[SimConnect] Data read error (requestID=${recv.requestID}): ${(err as Error).message}`);
          this._loggedReadError = true;
        }
      }
    });
  }

  private setupEventHandlers(handle: SimConnectConnection): void {
    handle.on('event', (recv) => {
      switch (recv.clientEventId) {
        case SystemEventID.PAUSE:
          this.emit('paused', recv.data === 1);
          break;
        case SystemEventID.SIM_START:
          this.emit('simStart');
          // Re-request aircraft info on new flight
          requestAllData(handle);
          break;
        case SystemEventID.SIM_STOP:
          this.emit('simStop');
          break;
        case SystemEventID.CRASHED:
          this.emit('crashed');
          break;
      }
    });

    handle.on('exception', (recv) => {
      console.error(`[SimConnect] Exception: ${recv.exception} (sendId: ${recv.sendId}, index: ${recv.index})`);
    });
  }

  private setupLifecycleHandlers(handle: SimConnectConnection): void {
    let simQuitting = false;

    handle.on('quit', () => {
      console.log(`[SimConnect] Simulator is shutting down`);
      simQuitting = true;
      this._connected = false;
      this.handle = null;
      this.emit('disconnected');
      this.scheduleReconnect();
    });

    handle.on('close', () => {
      if (!simQuitting && !this._closing) {
        console.warn(`[SimConnect] Connection lost unexpectedly`);
        this._connected = false;
        this.handle = null;
        this.emit('disconnected');
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this._closing || this.reconnectTimer) return;
    console.log(`[SimConnect] Reconnecting in ${this.reconnectInterval / 1000}s...`);
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

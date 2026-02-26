import { open, Protocol, type SimConnectConnection, type RecvOpen } from 'node-simconnect';
import { EventEmitter } from 'events';
import { config } from '../config.js';
import { registerAllDefinitions, requestAllData, subscribeSystemEvents, SystemEventID, RequestID } from './definitions.js';
import { readPosition, readEngine, readFuel, readFlightState, readAutopilot, readRadio, readAircraftInfo } from './reader.js';
import type { ConnectionStatus } from '@acars/shared';
import type { ISimConnectManager } from './types.js';
import { logger } from '../lib/logger.js';

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

  get connected(): boolean {
    return this._connected;
  }

  getConnectionStatus(): ConnectionStatus {
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

    logger.info('SimConnect', 'Attempting connection...');

    open(config.simconnect.appName, Protocol.KittyHawk)
      .then(({ recvOpen, handle }) => {
        logger.info('SimConnect', `Connected to ${recvOpen.applicationName} (v${recvOpen.applicationVersionMajor}.${recvOpen.applicationVersionMinor})`);

        this.handle = handle;
        this._simInfo = recvOpen;
        this._connected = true;
        this._lastError = '';

        // Register definitions & start data flow
        registerAllDefinitions(handle);
        requestAllData(handle);
        subscribeSystemEvents(handle);

        this.emit('connected', this.getConnectionStatus());

        // Wire up data handlers
        this.setupDataHandlers(handle);
        this.setupEventHandlers(handle);
        this.setupLifecycleHandlers(handle);
      })
      .catch((err: Error) => {
        const msg = err.message || String(err) || 'Unknown error';
        const isNormal = msg.includes('ECONNREFUSED') || msg.includes('pipe')
          || msg.includes('AggregateError') || err.name === 'AggregateError'
          || !msg || msg === 'Unknown error';
        this._lastError = isNormal ? 'Waiting for MSFS...' : msg;
        logger.info('SimConnect', `Connection failed: ${msg}`);
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
          logger.warn('SimConnect', `Data read error (requestID=${recv.requestID}): ${(err as Error).message}`);
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
      logger.error('SimConnect', `Exception: ${recv.exception} (sendId: ${recv.sendId}, index: ${recv.index})`);
    });
  }

  private setupLifecycleHandlers(handle: SimConnectConnection): void {
    let simQuitting = false;

    handle.on('quit', () => {
      logger.info('SimConnect', 'Simulator is shutting down');
      simQuitting = true;
      this._connected = false;
      this.handle = null;
      this.emit('disconnected');
      this.scheduleReconnect();
    });

    handle.on('close', () => {
      if (!simQuitting && !this._closing) {
        logger.warn('SimConnect', 'Connection lost unexpectedly');
        this._connected = false;
        this.handle = null;
        this.emit('disconnected');
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this._closing || this.reconnectTimer) return;
    logger.info('SimConnect', `Reconnecting in ${config.simconnect.reconnectInterval / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptConnection();
    }, config.simconnect.reconnectInterval);
  }

  private detectSimVersion(): ConnectionStatus['simulator'] {
    const name = (this._simInfo.applicationName || '').toLowerCase();
    if (name.includes('2024') || name.includes('kittyhawk')) return 'msfs2024';
    if (name.includes('2020') || name.includes('fs2020')) return 'msfs2020';
    return this._connected ? 'msfs2024' : 'unknown'; // default to 2024 for KittyHawk protocol
  }
}

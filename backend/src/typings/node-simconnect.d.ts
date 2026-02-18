/**
 * Ambient type declarations for node-simconnect.
 * Used as a fallback when the native package is not installed (Linux).
 * On Windows, the real package types take precedence.
 */
declare module 'node-simconnect' {
  import { EventEmitter } from 'events';

  export interface SimConnectConnection extends EventEmitter {
    addToDataDefinition(
      defineId: number,
      datumName: string,
      unitsName: string | null,
      dataType: number,
      epsilon?: number,
      datumId?: number,
    ): void;
    requestDataOnSimObject(
      requestId: number,
      defineId: number,
      objectId: number,
      period: number,
      flags?: number,
    ): void;
    subscribeToSystemEvent(eventId: number, eventName: string): void;
    close(): void;
  }

  export interface RecvOpen {
    applicationName: string;
    applicationVersionMajor: number;
    applicationVersionMinor: number;
    applicationBuildMajor: number;
    applicationBuildMinor: number;
    simConnectVersionMajor: number;
    simConnectVersionMinor: number;
    simConnectBuildMajor: number;
    simConnectBuildMinor: number;
  }

  export interface RawBuffer {
    readFloat64(): number;
    readFloat32(): number;
    readInt64(): bigint;
    readInt32(): number;
    readString8(): string;
    readString32(): string;
    readString64(): string;
    readString128(): string;
    readString256(): string;
    readString260(): string;
  }

  export const Protocol: {
    FSX_SP2: number;
    KittyHawk: number;
  };

  export const SimConnectConstants: {
    OBJECT_ID_USER: number;
  };

  export const SimConnectPeriod: {
    NEVER: number;
    ONCE: number;
    VISUAL_FRAME: number;
    SIM_FRAME: number;
    SECOND: number;
  };

  export const DataRequestFlag: {
    DATA_REQUEST_FLAG_DEFAULT: number;
    DATA_REQUEST_FLAG_CHANGED: number;
    DATA_REQUEST_FLAG_TAGGED: number;
  };

  export function open(
    appName: string,
    protocol: number,
  ): Promise<{ recvOpen: RecvOpen; handle: SimConnectConnection }>;
}

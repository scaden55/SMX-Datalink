# Aircraft Selection at Bid Time

## Summary

Remove aircraft assignment from charter creation. Pilots choose which aircraft to fly when placing a bid, with location enforcement and suitability warnings.

## Data Model

### Migration 024-bid-aircraft.sql

- `active_bids.aircraft_id` — INTEGER REFERENCES fleet(id), nullable for legacy rows
- `scheduled_flights.aircraft_type` becomes nullable (charters without a pre-assigned type)

### CreateCharterRequest

Remove `aircraftType`. Fields: `charterType`, `depIcao`, `arrIcao`, `depTime`.

## Bid Placement (POST /api/bids)

Payload: `{ scheduleId, aircraftId }`

### Hard blocks (bid rejected)

1. Aircraft `status != 'active'` — "Aircraft is not active"
2. Aircraft location doesn't match departure — compare `COALESCE(location_icao, base_icao)` against `scheduled_flights.dep_icao`

### Soft warnings (bid placed, warnings returned)

1. **Range**: `range_nm * 0.9 < route distance_nm`
2. **Runway**: destination longest runway < `minRunwayForCategory(cat)`
3. **Type mismatch**: cargo aircraft on pax charter, or pax aircraft on cargo charter (reposition = no check)

Response: `{ bid, warnings: string[] }`

## Frontend

### Bid flow

Click "Bid" opens an aircraft selector showing active fleet. Aircraft not at departure are greyed out/disabled. Suitability issues get warning icons. Pilot selects, confirms, warnings shown as toast.

### Charter modal

Remove aircraft dropdown. Only: charter type, departure, arrival, departure time. Flight time estimated with default 450 kts cruise.

### Schedule display

Charters without aircraft_type show "Any" in the aircraft column.

## Charter Generation: Location-Aware Routes

In monthly generation, add a fleet-position pass:
- For each active aircraft, get `COALESCE(location_icao, base_icao)`
- Generate 1-2 charters departing from that airport with matching aircraft type
- Target ~20-30% of total generated charters
- Cargo-biased (reflects SMA Virtual identity)

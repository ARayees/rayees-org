/*
  First Jet Model — shared calculation core
  Version 0.4

  This file is deliberately small and readable. The browser page uses it, and
  scripts/validate_model.mjs tests the same calculations outside the browser.
*/
(function () {
  const aircraft = {
    a319: { name: 'Airbus A319', seats: 144 },
    a320ceo: { name: 'Airbus A320ceo', seats: 180 },
    a320neo: { name: 'Airbus A320neo', seats: 186 },
    b738: { name: 'Boeing 737-800', seats: 186 }
  };

  const scale = {
    small: { fleet: 2, flightLegsPerDay: 3, days: 330, conversion: 0.25 },
    base: { fleet: 4, flightLegsPerDay: 4, days: 330, conversion: 0.50 },
    growth: { fleet: 8, flightLegsPerDay: 5, days: 330, conversion: 0.75 }
  };

  const demand = {
    conservative: 0.72,
    expected: 0.80,
    strong: 0.86
  };

  // These are transparent V1 cost proxies, not First Jet quotations.
  const structure = {
    direct: { blockCost: 4700, fixedAircraft: 3900000, support: 5200000 },
    acmi: { blockCost: 7600, fixedAircraft: 950000, support: 3600000 },
    charter: { blockCost: 6500, fixedAircraft: 700000, support: 3000000 }
  };

  const defaults = {
    investors: 11160,
    investorSnapshot: 'November 3, 2026 at 8:33 PM PT',
    ancillary: 66.56,
    baseFare: 75,
    membershipFee: 100,
    blockHoursPerFlightLeg: 2.0
  };

  function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function calculateScenario(input) {
    const fleet = Math.max(0, finite(input.fleet, 0));
    const flightLegsPerDay = Math.max(0, finite(input.flightLegsPerDay ?? input.flights, 0));
    const operatingDays = Math.max(0, finite(input.operatingDays ?? input.days, 0));
    const seatsPerFlightLeg = Math.max(0, finite(input.seats, 0));
    const loadFactor = Math.max(0, Math.min(1, finite(input.loadFactor ?? input.load, 0)));
    const averageFare = Math.max(0, finite(input.averageFare ?? input.fare, 0));
    const membershipFee = Math.max(0, finite(input.membershipFee ?? input.fee, 0));
    const ancillaryPerPassenger = Math.max(0, finite(input.ancillary, 0));
    const investors = Math.max(0, finite(input.investors, 0));
    const conversion = Math.max(0, Math.min(1, finite(input.conversion, 0)));
    const blockHoursPerFlightLeg = Math.max(0, finite(input.blockHours ?? input.blockHoursPerFlightLeg, defaults.blockHoursPerFlightLeg));
    const variableCostPerBlockHour = Math.max(0, finite(input.blockCost, 0));
    const fixedAircraftCost = Math.max(0, finite(input.fixedAircraft, 0));
    const annualSupportCost = Math.max(0, finite(input.support, 0));

    const annualDepartures = fleet * flightLegsPerDay * operatingDays;
    const availableSeats = annualDepartures * seatsPerFlightLeg;
    const annualPassengers = availableSeats * loadFactor;
    const annualBlockHours = annualDepartures * blockHoursPerFlightLeg;
    const estimatedPayingMembers = investors * conversion;

    // V1 treats the base fare as the average realized fare across passengers.
    // No separate member-fare discount is modeled until First Jet provides it.
    const ticketRevenue = annualPassengers * averageFare;
    const ancillaryRevenue = annualPassengers * ancillaryPerPassenger;
    const membershipRevenue = estimatedPayingMembers * membershipFee;
    const totalRevenue = ticketRevenue + ancillaryRevenue + membershipRevenue;

    const flyingCost = annualBlockHours * variableCostPerBlockHour;
    const aircraftFixedCost = fleet * fixedAircraftCost;
    const totalCost = flyingCost + aircraftFixedCost + annualSupportCost;
    const operatingResult = totalRevenue - totalCost;
    const operatingMargin = totalRevenue === 0 ? null : operatingResult / totalRevenue;

    const revenuePerPassenger = averageFare + ancillaryPerPassenger;
    const breakEvenPassengers = revenuePerPassenger === 0
      ? (totalCost > membershipRevenue ? Infinity : 0)
      : Math.max(0, (totalCost - membershipRevenue) / revenuePerPassenger);
    const breakEvenLoadFactor = availableSeats === 0 ? Infinity : breakEvenPassengers / availableSeats;

    return {
      annualDepartures,
      availableSeats,
      annualPassengers,
      annualBlockHours,
      estimatedPayingMembers,
      ticketRevenue,
      ancillaryRevenue,
      membershipRevenue,
      totalRevenue,
      flyingCost,
      aircraftFixedCost,
      annualSupportCost,
      totalCost,
      operatingResult,
      operatingMargin,
      breakEvenPassengers,
      breakEvenLoadFactor,
      feasibleBreakEven: Number.isFinite(breakEvenLoadFactor) && breakEvenLoadFactor <= 1
    };
  }

  window.FirstJetModel = { aircraft, scale, demand, structure, defaults, calculateScenario };
})();

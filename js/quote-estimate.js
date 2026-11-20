(function (scope) {
  "use strict";
  function cents(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0 || value > 100000) throw new Error("Enter a valid nonnegative rate.");
    return Math.round(value * 100);
  }
  function estimate(guests, minimum, perPerson, fixed) {
    if (!Number.isInteger(guests) || !Number.isInteger(minimum) || minimum < 1 || guests < minimum || guests > 10000) {
      throw new Error("Enter a whole guest count from " + minimum + " to 10,000.");
    }
    return (perPerson.reduce((sum, rate) => sum + cents(rate), 0) * guests + fixed.reduce((sum, rate) => sum + cents(rate), 0)) / 100;
  }
  const api = { estimate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else scope.Project318QuoteEstimate = api;
})(typeof window !== "undefined" ? window : globalThis);

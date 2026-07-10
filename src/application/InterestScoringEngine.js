const SIGNAL_SCORES = {
  viewed: 2,
  repeated_view: 4,
  added_to_cart: 8,
  wishlist: 7,
  price_drop: 6,
};

class InterestScoringEngine {
  calculateScore({ signal, previousScore = 0, interactionCount = 1 }) {
    const signalScore = SIGNAL_SCORES[signal] ?? 0;
    const repetitionBonus = signal === 'repeated_view'
      ? Math.min(interactionCount - 1, 3)
      : 0;

    return Math.min(Math.max(previousScore, signalScore) + repetitionBonus, 10);
  }
}

module.exports = { InterestScoringEngine, SIGNAL_SCORES };

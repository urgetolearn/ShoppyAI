const THREE_HOURS_IN_MS = 3 * 60 * 60 * 1000;

class SimpleReminderPlanner {
  evaluateInterest(context) {
    const elapsedMs =
      context.evaluatedAt.getTime() - context.interest.lastInteractionAt.getTime();
    const hasEnoughTimePassed = elapsedMs >= THREE_HOURS_IN_MS;

    if (!hasEnoughTimePassed) {
      return {
        shouldNotify: false,
        priority: 'none',
        reason: 'At least 3 hours have not passed yet.',
      };
    }

    if (context.interest.score >= 8) {
      return {
        shouldNotify: true,
        priority: 'high',
        scheduledFor: context.evaluatedAt,
        reason: 'Interest score is high priority.',
      };
    }

    if (context.interest.score >= 5) {
      return {
        shouldNotify: true,
        priority: 'normal',
        scheduledFor: context.evaluatedAt,
        reason: 'Interest score is normal priority.',
      };
    }

    return {
      shouldNotify: false,
      priority: 'none',
      reason: 'Interest score is below reminder threshold.',
    };
  }
}

module.exports = { SimpleReminderPlanner };

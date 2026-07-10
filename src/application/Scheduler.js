class Scheduler {
  constructor({ intervalMs = 30_000, task }) {
    this.intervalMs = intervalMs;
    this.task = task;
    this.timer = null;
    this.isRunning = false;
  }

  start({ runImmediately = true } = {}) {
    if (this.timer) {
      return;
    }

    if (runImmediately) {
      void this.runOnce();
    }

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.task();
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = { Scheduler };

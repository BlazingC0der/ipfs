import * as Sentry from "@sentry/node"
import * as Tracing from "@sentry/tracing"
import CronJob from "./cron.mjs"

Sentry.init({
    dsn: "https://decd745fa19c4f87a38b06c29bdc8910@o1356895.ingest.sentry.io/6642762",
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
})

const transaction = Sentry.startTransaction({
    op: "test",
    name: "My First Test Transaction",
})

setTimeout(() => {
    try {
        CronJob()
    } catch (e) {
        Sentry.captureException(e)
    } finally {
        transaction.finish()
    }
}, 99)

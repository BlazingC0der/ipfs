import CronJob from "./cron.mjs"
import PostFileLink from "./endpoints/file-post.mjs"
import callback from "./endpoints/cb.mjs"

PostFileLink()
callback()
CronJob()
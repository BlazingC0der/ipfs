import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const cron = require('node-cron')
import axios from 'axios'
import fs from 'fs'
import DbGen from './pg.mjs'
import uploader from './uploader.mjs'
import 'dotenv/config'

const DbClient = DbGen()

DbClient.connect()
DbClient.on("connect", () => console.log("connection with DB established through port 5432"))


cron.schedule('*/15 * * * * *', async () => {
    const retries = process.env.MaxRetries
    const result = await DbClient.query(`SELECT (file_url,callback,status,filename,guid) FROM jobs
                WHERE NOT status = $1`, ["uploaded"])
    const rows = []
    for (const iter of result.rows) {
        let row = iter.row.substr(1, iter.row.length - 2)
        row = row.split(",")
        rows.push({ url: row[0], cb: row[1], status: row[2], filename: row[3], guid: row[4] })
    }
    for (const row of rows) {
        for (let i = 0; i < retries; i++) {
            let uploaded = uploader(row.guid, row.name, row.cb, row.url)
            if (uploaded) {
                break
            } else if (!uploaded && i === 2) {
                axios.post(row.cb, { error: "request limit reached!" })
            }
        }
    }
})

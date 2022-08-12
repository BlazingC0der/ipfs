import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const cron = require('node-cron')
import axios from 'axios'
import fs from 'fs'
import DbGen from './pg.mjs'
import uploader from './uploader.mjs'
import 'dotenv/config'
import downloader from './downloader.mjs'

const DbClient = DbGen()

DbClient.connect()
DbClient.on("connect", () => console.log("connection with DB established through port 5432"))

const updater = (url, retries, status = "", err = null) => {
    if (err) {
        DbClient.query(`UPDATE jobs
                    SET error=$1, status=$2
                    WHERE file_url=$3 RETURNING*`, [err, status, url], (err, result) => {
            if (err) {
                console.log(err)
            } else {
                console.log(result.rows)
            }
        })
    } else {
        DbClient.query(`UPDATE jobs
                    SET retries=$1,
                    WHERE file_url=$3 RETURNING*`, [retries, url], (err, result) => {
            if (err) {
                console.log(err)
            } else {
                console.log(result.rows)
            }
        })
    }
}

cron.schedule('* * * * *', async () => {
    const result = await DbClient.query(`SELECT (file_url,callback,status,filename,guid,retries) FROM jobs
                WHERE NOT status = $1`, ["uploaded"])
    const rows = []
    for (const iter of result.rows) {
        let row = iter.row.substr(1, iter.row.length - 2)
        row = row.split(",")
        rows.push({ url: row[0], cb: row[1], status: row[2], filename: row[3], guid: row[4], retries: row[5] })
    }
    for (const row of rows) {
        if (row.retries > 0) {
            let downloaded = await downloader(row.url, row.guid)
            if (downloaded) {
                let uploaded = uploader(row.guid, row.filename, row.cb, row.url)
                uploaded ? fs.unlink(`./pdfs/${row.guid}.pdf`) : updater(row.url, row.retries - 1)
            } else {
                updater(row.url, row.retries - 1)
            }
        } else {
            updater(row.url, null, "failed", "request limit reached!")
            axios.post(row.cb, { status: "failed", url: null, error: "request limit reached!" })
        }
    }
})

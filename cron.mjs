import { createRequire } from "module"
const require = createRequire(import.meta.url)
const cron = require("node-cron")
import axios from "axios"
import fs from "fs"
import DbGen from "./pg.mjs"
import uploader from "./uploader.mjs"
import "dotenv/config"
import downloader from "./downloader.mjs"
import winston from "winston"
// logger object for logging errors into log file
const logger = winston.createLogger({
    level: "error",
    format: winston.format.json(),
    defaultMeta: { service: "user-service" },
    transports: [
        // - Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({ filename: "error.log", level: "error" }),
    ],
})

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()
DbClient.on("connect", () =>
    console.log("connection with DB established through port 5432")
)
// @param id: job id (PK in db)
// @param  params: updated no. of retries or error msg and status if no. of retires > 0
const updater = (id, ...params) => {
    if (params.length === 2) {
        //* updating status to failed and providing error due to exhaustion of retires
        DbClient.query(
            `UPDATE jobs
                    SET error=$1, status=$2
                    WHERE id=$3 RETURNING*`,
            [params[1], params[0], id],
            (err, result) => {
                if (err) {
                    console.log(err)
                    logger.error(err)
                } else {
                    console.log(result.rows)
                }
            }
        )
    } else {
        //* decrementing no. of retries in DB
        DbClient.query(
            `UPDATE jobs
                    SET retries=$1,
                    WHERE id=$3 RETURNING*`,
            [params[0], id],
            (err, result) => {
                if (err) {
                    console.log(err)
                    logger.error(err)
                } else {
                    console.log(result.rows)
                }
            }
        )
    }
}

const IpfsUpload = async (tuples) => {
    const rows = []
    for (const iter of tuples.rows) {
        let row = iter.row.substr(1, iter.row.length - 2)
        row = row.split(",") // converting string row data to array where each attribute's value is stored at a distinct index
        rows.push({
            url: row[0],
            cb: row[1],
            status: row[2],
            filename: row[3],
            guid: row[4],
            retries: row[5],
            id: row[6],
        })
    }
    for (const row of rows) {
        if (row.retries > 0) {
            //* attempting to upload file to ipfs
            let downloaded = await downloader(
                //* downloading file from s3
                row.id,
                row.guid,
                row.url,
                row.retries
            )
            if (downloaded) {
                // true if downlaod was sucessful
                let uploaded = await uploader(
                    //* uplaoding to ipfs
                    row.guid,
                    row.filename,
                    row.cb,
                    row.id,
                    row.retries
                )
                if (uploaded) {
                    // true if upload was sucessful
                    //* deleting file form local storage once it's uploaded to ipfs
                    fs.unlink(`./pdfs/${row.guid}.pdf`, (err) => {
                        console.log("deleting...")
                        err ? logger.error(err) : console.log("deleted!")
                    })
                }
            } else {
                //* decrement retries in DB if file not downloaded sucessfully
                updater(row.id, row.retries - 1)
            }
        } else {
            //* update status to failed and update error msg attribute for exhausting no. of retries
            updater(row.id, "failed", "request limit reached!")
            try {
                //* posting feedback to callback api to inform about failure to upload the file to ipfs
                axios.post(row.cb, {
                    status: "failed",
                    url: null,
                    error: "request limit reached!",
                })
            } catch (error) {
                logger.error(error)
                throw error
            }
        }
    }
}

const CronJob = () => {
    cron.schedule("* * * * *", () => {
        // "* * * * *" arguement passed makes the cron job run after a minute's interval
        //* getting data for files whose upload is still pending
        DbClient.query(
            `SELECT (file_url,callback,status,filename,guid,retries,id) FROM jobs
                WHERE status = $1`,
            ["pending"],
            (err, result) => {
                if (err) {
                    logger.error(err)
                    console.log(err)
                } else {
                    console.log(result.rows)
                    IpfsUpload(result)
                }
            }
        )
    })
}

CronJob()

export default CronJob
